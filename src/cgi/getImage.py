#! /usr/bin/python

# Requires Python 2.5+

import cgitb
cgitb.enable()

import cgi
import urllib2
import base64
import os.path
import sys
import socket
import simplejson as json

socket.setdefaulttimeout(30)

form = cgi.FieldStorage()

urls = form.getlist('url')

callback = form.getlist('callback')
if callback is not None and len(callback):
    callback = callback[0]
else:
    callback = ''

if len(urls) < 1:
    print 'Content-Type: application/x-javascript'
    print
    print '%s(%s)' % (callback, json.dumps({'error': 'Invalid url'}))
    sys.exit()

url = urllib2.unquote(urls[0])
ext = os.path.splitext(url)[1]

if ext.lower() not in ['.png', '.jpg', '.gif']:
    print 'Content-Type: application/x-javascript'
    print
    print '%s(%s)' % (callback, json.dumps({'error': 'Invalid extension'}))
    sys.exit()

try:
    u = urllib2.urlopen(url)
    dta=u.read()
    
except:
    print 'Content-Type: application/x-javascript'
    import traceback
    traceback.print_exc(file=sys.stdout)
    sys.exit()

d = {'data':'data:%s;base64,%s' % (u.headers.get('Content-Type'), base64.encodestring(dta).replace('\n', ''))}

for k,v in u.headers.items():
    if k.lower() in ['content-type', 'via', 'x-cache', 'x-cache-lookup', 'server', 'accept-ranges', 'content-length']:
        continue

    print '%s: %s' % (k,v)

cnt='%s(%s)' % (callback,json.dumps(d))

print 'Content-Type: application/x-javascript'
print 'Content-length: %i' % (len(cnt))
print

print cnt
