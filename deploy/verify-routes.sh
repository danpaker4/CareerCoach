#!/usr/bin/env bash
# Checks that every backend API prefix actually reaches its service through nginx.
#
#   ./deploy/verify-routes.sh                                  # against the public host
#   ./deploy/verify-routes.sh https://careercoach.cs.colman.ac.il
#
# The failure this guards against: a path prefix that no location block matches
# falls through to `try_files $uri /index.html` and nginx answers 200 text/html.
# The browser then gets the SPA shell where it expected JSON, and the feature
# fails silently in production while working fine locally against the service
# port. Status codes are irrelevant here - 400/401/404 all prove the request
# reached the service. Only an HTML body means it did not.
set -uo pipefail

BASE="${1:-https://careercoach.cs.colman.ac.il}"

# Every path the browser calls, one per API prefix. Keep in sync with the
# location blocks in deploy/nginx/careercoach.conf.
PATHS=(
    # users-service
    /api/auth/session
    /users/verify-routes-probe
    # chat-service
    /chat/verify-routes-probe
    # job-service
    /jobs
    /jobs-in-pipeline/verify-routes-probe
    /career-roadmap/verify-routes-probe
    /notifications/verify-routes-probe
    /notifications/verify-routes-probe/unread-count
    /notifications/verify-routes-probe/stream
    /wanted-jobs/verify-routes-probe
    # evaluation-service
    /evaluation-cases
    # roadmap-service
    /roadmap/generate
)

failed=0
for path in "${PATHS[@]}"; do
    # The /stream probe is a long-lived SSE connection: it deliberately runs into
    # the timeout, having already reported its headers.
    read -r code type < <(curl -sk -m 8 -o /dev/null \
        -w '%{http_code} %{content_type}\n' "${BASE}${path}")
    case "${type}" in
        text/html*)
            printf 'FAIL  %-48s %s %s (fell through to the SPA)\n' "${path}" "${code}" "${type}"
            failed=1
            ;;
        *)
            printf 'ok    %-48s %s %s\n' "${path}" "${code}" "${type}"
            ;;
    esac
done

if [ "${failed}" -ne 0 ]; then
    echo "Some API prefixes are not routed - add them to deploy/nginx/careercoach.conf" >&2
    exit 1
fi
echo "All API prefixes reach a backend service."
