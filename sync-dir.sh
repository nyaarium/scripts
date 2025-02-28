#!/bin/bash

set -e


# Parse flags
WATCH_INTERVAL=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --setup)
            if [ "$EUID" -ne 0 ]; then
                echo "Error: --setup must be run as root:"
                echo "  sudo $(realpath --relative-to=. "$0") --setup"
                echo ""
                exit 1
            fi

            apt install -y unison encfs
            echo ""

            # Check if metadata option exists
            if grep -q "options.*=.*metadata" "/etc/wsl.conf"; then
                echo "Metadata option already exists in wsl.conf. If you haven't already, restart WSL."
                echo ""
                echo "From Windows PowerShell, run:"
                echo "  wsl --shutdown"
            else
                echo "Updating wsl.conf with metadata option..."
                # Check if [automount] section exists
                if ! grep -q "\[automount\]" "/etc/wsl.conf"; then
                    echo >> "/etc/wsl.conf"
                    echo "[automount]" >> "/etc/wsl.conf"
                fi
                # Append under [automount] section
                sed -i '/\[automount\]/a options = "metadata"' "/etc/wsl.conf"
            
                echo "WSL configuration updated. Please restart WSL for changes to take effect."
                echo ""
                echo "From Windows PowerShell, run:"
                echo "  wsl --shutdown"
            fi
            
            echo ""
            exit 0
            ;;
        --watch)
            if [[ ! $2 =~ ^[0-9]+$ ]]; then
                echo "Error: --watch requires a number in seconds"
                echo "Usage: $0 [--watch <seconds>] DIR_A DIR_B"
                exit 1
            fi
            WATCH_INTERVAL="$2"
            shift 2
            ;;
        -*)
            echo "Error: Unknown flag $1"
            echo "Usage: $0 [--setup | --watch <seconds>] DIR_A DIR_B"
            exit 1
            ;;
        *)
            break
            ;;
    esac
done

# Validate remaining args are directories
if [ "$#" -ne 2 ]; then
    echo "Error: Expected exactly 2 directory arguments"
    echo "Usage: $0 [--setup | --watch <seconds>] DIR_A DIR_B"
    exit 1
fi

DIR_A="$1"
DIR_B="$2"

# Validate directories exist
if [ ! -d "$DIR_A" ] || [ ! -d "$DIR_B" ]; then
    echo "Error: Both parameters must be existing directories"
    exit 1
fi

# Test filesystem permission support
echo "Testing filesystem permission support..."
TEST_FILE_A="$DIR_A/.permission_test"
TEST_FILE_B="$DIR_B/.permission_test"

# Create test files
touch "$TEST_FILE_A" "$TEST_FILE_B"
chmod 664 "$TEST_FILE_A" "$TEST_FILE_B"

# Get actual permissions in octal
PERMS_A=$(stat -c '%a' "$TEST_FILE_A")
PERMS_B=$(stat -c '%a' "$TEST_FILE_B")

# Verify permissions applied
if [ "$PERMS_A" != "664" ]; then
    rm -f "$TEST_FILE_A" "$TEST_FILE_B"
    echo "Error: Filesystem for \"$DIR_A\" does not support Unix permissions"
    echo ""
    echo "Run this script as root with --setup flag:"
    echo "  sudo ./$(realpath --relative-to=. "$0") --setup"
    echo ""
    exit 1
fi
if [ "$PERMS_B" != "664" ]; then
    rm -f "$TEST_FILE_A" "$TEST_FILE_B"
    echo "Error: Filesystem for \"$DIR_B\" does not support Unix permissions"
    echo ""
    echo "Run this script as root with --setup flag:"
    echo "  sudo ./$(realpath --relative-to=. "$0") --setup"
    echo ""
    exit 1
fi

# Clean up test files
rm -f "$TEST_FILE_A" "$TEST_FILE_B"


# Beginning of the sync script

# Convert to absolute paths
DIR_A=$(realpath "$DIR_A")
DIR_B=$(realpath "$DIR_B")

echo "Starting bidirectional sync between:"
echo "  $DIR_A"
echo "  $DIR_B"
echo ""


nice -n 19 ionice -c 3 \
    unison "$DIR_A" "$DIR_B" \
    -batch \
    -fastcheck true \
    -ignoreinodenumbers \
    -links true \
    -maxthreads 8 \
    -owner -group -times \
    -perms 775 \
    -prefer newer \
    -rsync \
    -ui text \
    ${WATCH_INTERVAL:+"-watch"} \
    ${WATCH_INTERVAL:+"-repeat"} \
    ${WATCH_INTERVAL:+"$WATCH_INTERVAL"}
