#! /usr/bin/python

import sys
import webbrowser
import SimpleHTTPServer

url=sys.argv[1]

# Remove parameter from middle
sys.argv[1:2]=[]

if sys.argv[1:]:
	port = int(sys.argv[1])
else:
	port = 8000

# Open url
webbrowser.open("http://localhost:%i/%s" % (port, url))

# Start server
SimpleHTTPServer.test();
