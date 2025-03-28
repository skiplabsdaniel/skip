#!/bin/bash

# shellcheck disable=SC2064 # Intentional use of current script pid
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

db=$(mktemp /tmp/db.XXXXXX)
tailfile=$(mktemp /tmp/tail.XXXXXX)
file1=$(mktemp /tmp/file.XXXXXX)
file2=$(mktemp /tmp/file.XXXXXX)

rm -Rf "$db" "$tailfile" "$file1" "$file2"

if [ -z "$SKDB_BIN" ]; then
    if [ -z "$SKARGO_PROFILE" ]; then
        SKARGO_PROFILE=dev
    fi
    SKDB_BIN="skargo run -q --profile $SKARGO_PROFILE -- "
fi

$SKDB_BIN --init "$db"
skdb="$SKDB_BIN --data $db"

$skdb < privacy/init.sql
echo "create table t1 (a INTEGER);" | $skdb
echo "create table t2 (a INTEGER);" | $skdb

sessionID=$($skdb subscribe t1 --connect)

# Starting the tailer
tail -f /dev/null | $skdb tail "$sessionID" --follow > "$tailfile"&

# First let's insert something

echo "insert into t1 values(0);" | $skdb

# And make sure that the tailer picked it up

while ! grep "0" "$tailfile" -q > /dev/null; do
    sleep 1
done

# Let's add a lot of the same data

for _ in {1..100}; do
    echo "insert into t1 values(1);"
done | $skdb

echo "insert into t1 values(-1);" | $skdb

# Let's make sure a purge actually occurred.

while ! cat "$tailfile" | tr '\t' 'Y' | grep -E '[-]1' -q > /dev/null; do
    sleep 1
done

wc "$tailfile"

cat "$tailfile" | $skdb write-csv > /dev/null

echo "select * from t1;" | $skdb > "$file1"
echo "select * from t2;" | $skdb > "$file2"

diff "$file1" "$file2" > /dev/null
if [ $? -eq 0 ]; then
    echo "PURGE TEST: OK"
else
    echo "PURGE TEST: FAILED"
fi

rm -Rf "$db" "$tailfile" "$file1" "$file2"

jobs -rp | xargs kill
jobs -rp | xargs wait 2>/dev/null
