#!/bin/bash
if [ -z "$SKARGO_PROFILE" ]; then
    SKARGO_PROFILE=dev
fi

echo ""
echo "*******************************************************************************"
echo "* SKDB DIFF TESTS *"
echo "*******************************************************************************"
echo ""

./test_diff.sh
