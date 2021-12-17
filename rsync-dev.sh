#!/bin/bash
KEY=~/.ssh/id_rsa
SERVER=pirelli@nativo.cz
LPATH=~/www/pirelli-fakt-z-gitu
REMOTEPATH=/var/www/vhosts/pirellionline.cz/dev.pirellionline.cz
RPATH=$SERVER:$REMOTEPATH

case "$1" in
	start)
        echo "Ostra synchronizace"
        ARGS="--delete --progress"
        ;;
    *)
        echo "Dry run synchronizace (nic nekopiruje)"
        ARGS="--dry-run --delete --progress"
        ;;
esac

rsync -avz -e "ssh -i $KEY" $ARGS $LPATH/dist/ $RPATH/www/

if [ "$1" = 'gitlog' ]; then
    scp -i $KEY $RPATH/.git-status-remote $LPATH/.git-status-remote
    cat $LPATH/.git-status-remote
fi
