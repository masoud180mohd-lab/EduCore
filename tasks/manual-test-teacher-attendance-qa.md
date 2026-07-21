# Manual QA — Teacher attendance (IMP-006)

Prereqs: API on `:3000` with migrations + `seed:admin`; web on `:3001` with `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000`.

| #   | Step                                                       | Expect                                                  |
| --- | ---------------------------------------------------------- | ------------------------------------------------------- |
| 1   | Open `/login`, sign in with seed admin/staff               | Lands on teacher home for bound tenant                  |
| 2   | Ensure class + active enrollments exist (API or prior IMP) | Class appears in picker                                 |
| 3   | Attend → pick class/date → Open session                    | Navigates to mark screen                                |
| 4   | Toggle statuses → Save marks                               | Success banner; reload keeps marks                      |
| 5   | Retry Save quickly                                         | Idempotent (no duplicate errors)                        |
| 6   | Close session                                              | Controls disabled; Save blocked                         |
| 7   | Wrong tenant id in URL with other session cookie           | Redirect/login or access error — no other school roster |
| 8   | Toggle offline (devtools)                                  | Offline banner shows queue-not-enabled copy             |

Do not commit real passwords. Record pass/fail in your notes.
