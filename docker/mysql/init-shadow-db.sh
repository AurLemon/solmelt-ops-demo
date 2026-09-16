#!/bin/bash
set -eu

# Prisma migrate dev needs to create and remove a temporary shadow database.
# These privileges are intentionally limited to the local development user.
mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
GRANT CREATE, DROP, ALTER, REFERENCES ON *.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
SQL
