@echo off
echo === IPv6 ::1 (what the browser's localhost hits) ===
curl -s -m 5 -o NUL -w "HTTP %%{http_code}\n" "http://[::1]:8001/api/config"
echo === IPv4 127.0.0.1 (the fix target) ===
curl -s -m 5 -o NUL -w "HTTP %%{http_code}\n" "http://127.0.0.1:8001/api/config"
echo V6TEST_DONE
