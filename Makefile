INPUT_FILES =
LINT_FILES = 
TARGET = build/
TARGET_JS = build/htdocs/js/imageEdit.min.js
TARGET_HTDOCS = build/htdocs/
CGI_SRC = src/cgi
CGI_DST = build/htdocs/
SHADER_SRC = src/htdocs/shaders/
SHADER_DST = build/htdocs/shaders/

# IP address of our public server (needed for 'make publish')

IP ?= 10.82.133.161

###############################################################################

JQUERY_FILES=$(wildcard src/jquery/*.js)
UI_FILES=$(shell find src/ui -name *.js)
EFFECTS_FILES=$(shell find src/nok/effects -maxdepth 1 -name [cg]l*.js)

INPUT_FILES += $(addprefix --input , $(JQUERY_FILES) $(EFFECTS_FILES) $(UI_FILES))

LINT_FILES += $(filter-out src/goog/% src/jquery/% $(TARGET_JS), $(shell tools/calcdeps.py -o list -p src $(INPUT_FILES)))
LINT = java -jar tools/js.jar tools/jslint-check.js $(LINT_FILES)

.PHONY: deps debug lint htdocs release publish ssh dist serve serve-src docs

default: help

help:
	@echo
	@echo 'targets:'
	@echo '  clean                     clean up build/htdocs'
	@echo '  build                     generate regular build (compress files)'
	@echo '  debug                     generate debug build (do not compress files)'
	@echo '  lint                      check/lint source code files'
	@echo '  docs                      generate jsdoc'
	@echo '  publish                   deploy build/htdocs to webcl.nokiaresearch.com'
	@echo '  ssh                       ssh to www@webcl.nokiaresearch.com'
	@echo '  serve                     open browser and start simple http server, uses build folder'
	@echo '  serve-src                 same as ''make serve'' but uses the src folder'
	@echo
	@echo 'Note that Perl, Python and Java are required.'

publish:
	@rm -rf staging
	@cp -r -p build/htdocs staging
	ssh -i tomi-aarnio-nokloud-key www@${IP} 'rm -rf staging'
	rsync -azv -e "ssh -i tomi-aarnio-nokloud-key" staging www@${IP}:/home/www
	ssh -i tomi-aarnio-nokloud-key www@${IP} 'rm -rf photoeditor; mv staging photoeditor'
	ssh -i tomi-aarnio-nokloud-key www@${IP} './html/gzipfiles photoeditor js; ./html/gzipfiles photoeditor css; ./html/gzipfiles photoeditor html'
	@rm -rf staging

ssh:
	ssh -i tomi-aarnio-nokloud-key www@${IP}

all: $(TARGET_JS) htdocs

build: clean all

$(TARGET_JS): $(JQUERY_FILES) $(EFFECTS_FILES) $(UI_FILES) src/nok/*.js
#	$(LINT)

	mkdir -p $(dir $(TARGET_JS))

	head -15 src/jquery/10-jquery-1.4.2.js > $@
	head -10 src/jquery/50-jquery.mousewheel.min.js >> $@
	head -25 src/goog/base.js >> $@

#	python tools/calcdeps.py -f "--warning_level=QUIET" -f --define -f goog.DEBUG=false -p src -o compiled -c tools/compiler.jar $(INPUT_FILES) >> $@
	python tools/calcdeps.py -f --define -f goog.DEBUG=false -p src -o compiled -c tools/compiler.jar $(INPUT_FILES) --output_file $(TARGET_JS)

lint:
	$(LINT)

htdocs:
	make -f Makefile.htdocs
	mv $(TARGET_HTDOCS)/index-min.html $(TARGET_HTDOCS)/index.html
	cp -r $(CGI_SRC) $(CGI_DST)
	find $(CGI_DST)/ -name .svn -type d | xargs rm -rf

shaders:
	chmod 755 $(SHADER_SRC)/*
	cp $(SHADER_SRC)/* $(SHADER_DST)/
	chmod 755 $(SHADER_DST)/*

debug: clean
	mkdir -p $(dir $(TARGET_JS))
	python tools/calcdeps.py -f "--warning_level=QUIET" -p src -o script -c tools/compiler.jar $(INPUT_FILES) --output_file $(TARGET_JS)
	make -f Makefile.htdocs debug
	mv $(TARGET_HTDOCS)/index-min.html $(TARGET_HTDOCS)/index.html
	cp -r $(CGI_SRC) $(CGI_DST)

dist: clean all
	mkdir -p dist
	svn up
	cd build && zip -r ../dist/imageEdit-r`cd .. && svnversion`-`date +%Y%m%d-%H%M%S`.zip .

serve: build
	cd build && python ../tools/httpserve.py htdocs/index-min.html

serve-src:
	cd src && python ../tools/httpserve.py htdocs/index.html

deps:
	(cd src/goog && python ../../tools/calcdeps.py -o deps -p .. --output_file=deps.js)

clean:
	rm -rf build deps.htdocs.mk
	-rm -rf `find . -name .DS_Store` 
	make -f Makefile.htdocs clean

docs:
	JSDOCDIR=tools/jsdoc-toolkit tools/jsdoc-toolkit/jsrun.sh -t=tools/jsdoc-toolkit/templates/jsdoc -a -d=docs -r src/ui src/nok

