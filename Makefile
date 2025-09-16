NAME=next-up-lesson
DOMAIN=liuuner.ch

.PHONY: all pack install clean

dist:
	mkdir -p dist

all: dist/extension.js dist/prefs.js

node_modules: package.json
	npm install

dist/extension.js dist/prefs.js: node_modules tsconfig.json extension.ts prefs.ts lessons.ts nextUpLessonIndicator.ts | dist
	npm run build

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	glib-compile-schemas schemas

$(NAME).zip: dist/extension.js dist/prefs.js schemas/gschemas.compiled
	cp -r schemas dist/
	cp metadata.json dist/
	cp stylesheet.css dist/
	(cd dist && zip ../$(NAME).zip -9r .)

pack: $(NAME).zip

install: all schemas/gschemas.compiled
	mkdir -p ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)
	cp -r dist/* ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/
	cp stylesheet.css ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/
	cp metadata.json ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/
	cp -r schemas ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/

clean:
	rm -rf dist node_modules $(NAME).zip
