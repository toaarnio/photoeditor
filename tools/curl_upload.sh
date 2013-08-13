#!/bin/bash

export URL=https://code.nokia.com/dav/WebImageEditor/www/r156/

curl --insecure --user toaarnio --upload-file $1 $URL
