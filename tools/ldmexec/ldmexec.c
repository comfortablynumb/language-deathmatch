// ldmexec: run a command and report its resource usage.
//
// Usage: ldmexec [-m] <command> [args...]
//
// After the command exits, one line is written to file descriptor 3:
//   "<exit-code> <wall-ns> <user-ns> <sys-ns> <max-rss-kib>\n"
// and ldmexec exits with the command's exit code.
//
// Why a separate, tiny launcher: Linux keeps the high-water mark of the *old* address
// space when a process calls execve, so a program forked from a large parent (such as the
// Go harness) would report the parent's resident memory as its own ru_maxrss. Forking
// from this small static binary avoids that.
//
// Memory mode (-m): since Linux 6.2 the per-process RSS counters behind ru_maxrss and
// /proc/<pid>/status are per-CPU approximations, so a process touching less than a few
// hundred KiB can read as 0. In memory mode the child is traced, stopped right before it
// exits (PTRACE_EVENT_EXIT, address space still intact) and its exact RSS is read from
// /proc/<pid>/smaps_rollup (a page-table walk). The reported peak is
// max(ru_maxrss, exact RSS at exit). Tracing adds overhead, so memory runs are never timed.
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <sys/ptrace.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

enum { STATS_FD = 3, USAGE_ERROR = 2, EXEC_FAILED = 127 };

static long long now_ns(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (long long)ts.tv_sec * 1000000000LL + ts.tv_nsec;
}

static long long timeval_ns(struct timeval tv) {
    return (long long)tv.tv_sec * 1000000000LL + (long long)tv.tv_usec * 1000LL;
}

static int exit_code(int status) {
    if (WIFEXITED(status)) {
        return WEXITSTATUS(status);
    }

    return 128 + WTERMSIG(status);
}

static int wait_child(pid_t pid, int *status, struct rusage *usage) {
    while (wait4(pid, status, 0, usage) == -1) {
        if (errno != EINTR) {
            return -1;
        }
    }

    return 0;
}

// Exact resident set size (KiB) from the "Rss:" line of /proc/<pid>/smaps_rollup.
static long read_rss_kib(pid_t pid) {
    char path[64];
    char line[256];
    long rss = 0;
    snprintf(path, sizeof path, "/proc/%d/smaps_rollup", (int)pid);
    FILE *file = fopen(path, "r");

    if (file == NULL) {
        return 0;
    }

    while (fgets(line, sizeof line, file) != NULL) {
        if (sscanf(line, "Rss: %ld kB", &rss) == 1) {
            break;
        }
    }

    fclose(file);
    return rss;
}

// Resumes a traced child until it terminates, reading its exact RSS at the exit stop.
static int trace_child(pid_t pid, int *status, struct rusage *usage, long *exit_rss) {
    int options_set = 0;

    for (;;) {
        if (wait_child(pid, status, usage) == -1) {
            return -1;
        }

        if (!WIFSTOPPED(*status)) {
            return 0;
        }

        int signal = WSTOPSIG(*status);

        if (!options_set && signal == SIGTRAP) {
            // First stop: right after execve, before the program runs.
            ptrace(PTRACE_SETOPTIONS, pid, 0,
                   PTRACE_O_TRACEEXIT | PTRACE_O_TRACEEXEC | PTRACE_O_EXITKILL);
            options_set = 1;
            signal = 0;
        } else if ((*status >> 8) == (SIGTRAP | (PTRACE_EVENT_EXEC << 8))) {
            // A later execve by the program itself (e.g. the JDK launcher on musl re-executes
            // itself to set LD_LIBRARY_PATH): an event stop, not a signal to deliver. Without
            // PTRACE_O_TRACEEXEC it would arrive as a plain SIGTRAP and kill the program.
            signal = 0;
        } else if ((*status >> 8) == (SIGTRAP | (PTRACE_EVENT_EXIT << 8))) {
            *exit_rss = read_rss_kib(pid);
            signal = 0;
        }

        ptrace(PTRACE_CONT, pid, 0, signal);
    }
}

static void run_child(int memory_mode, char *argv[]) {
    if (memory_mode && ptrace(PTRACE_TRACEME, 0, NULL, NULL) == -1) {
        perror("ldmexec: ptrace");
        _exit(EXEC_FAILED);
    }

    execvp(argv[0], argv);
    perror("ldmexec: exec");
    _exit(EXEC_FAILED);
}

int main(int argc, char *argv[]) {
    const int memory_mode = argc > 1 && strcmp(argv[1], "-m") == 0;
    char **command = argv + 1 + memory_mode;

    if (command[0] == NULL) {
        fputs("usage: ldmexec [-m] <command> [args...]\n", stderr);
        return USAGE_ERROR;
    }

    // The stats descriptor must not leak into the measured program.
    if (fcntl(STATS_FD, F_SETFD, FD_CLOEXEC) == -1) {
        perror("ldmexec: file descriptor 3");
        return USAGE_ERROR;
    }

    const long long start = now_ns();
    const pid_t pid = fork();

    if (pid == -1) {
        perror("ldmexec: fork");
        return USAGE_ERROR;
    }

    if (pid == 0) {
        run_child(memory_mode, command);
    }

    int status = 0;
    long exit_rss = 0;
    struct rusage usage;
    const int waited = memory_mode ? trace_child(pid, &status, &usage, &exit_rss)
                                   : wait_child(pid, &status, &usage);

    if (waited == -1) {
        perror("ldmexec: wait4");
        return USAGE_ERROR;
    }

    const long long wall = now_ns() - start;
    const int code = exit_code(status);
    const long max_rss = usage.ru_maxrss > exit_rss ? usage.ru_maxrss : exit_rss;

    dprintf(STATS_FD, "%d %lld %lld %lld %ld\n", code, wall,
            timeval_ns(usage.ru_utime), timeval_ns(usage.ru_stime), max_rss);
    return code;
}
