import GLib from "gi://GLib";
import St from "gi://St";
import GObject from "gi://GObject";
import Clutter from 'gi://Clutter';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Gio from "gi://Gio";
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

type Lesson = {
    start: string,
    end: string,
    name: string
}

const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function getDayName(dayNumber: number): string {
    if (dayNumber < 1 || dayNumber > 7) {
        throw new Error("Invalid day number");
    }
    return daysOfWeek[dayNumber - 1];
}

export class LessonStatusIndicator extends PanelMenu.Button {
    label: St.Label;
    _lessonBefore: Lesson | undefined = undefined;
    _timer: number | undefined;
    _lessons: { [key: string]: Lesson[] } = {};
    // @ts-ignore
    // _notifyItem: PopupMenu.PopupMenuItem;
    // _reloadLessonsItem: PopupMenu.PopupMenuItem;
    _settings: Gio.Settings;
    // menu: PopupMenu.PopupMenu;

    static {
        GObject.registerClass(this);
    }

    constructor(settings: Gio.Settings) {
        super(0.0, "LessonStatusIndicator", false);

        this._settings = settings;

        this.label = new St.Label({
            text: this.getCurrentLesson(),
            y_align: Clutter.ActorAlign.CENTER,
            style: "font-size: 0.9em;"
        });
        this.add_child(this.label);

        // this.connect('button-press-event', () => this.menu.toggle());

        this._loadLessons().then(r => this._updateLesson());
        // this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.get_int("update-interval"), this._updateLesson);


        // this.menu.toggle();
        // Add action to toggle if the notification should be shown
        // this._notifyItem = new PopupMenu.PopupMenuItem("Notify");

        // this._notifyItem.connect('activate', () => this._toggleSettings('notify'));

        if (this.menu) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(_('Show')));
        }

        // this.menu.addMenuItem(
        //     new PopupMenu.PopupSeparatorMenuItem(_('Show')));

        /*this._cpuItem = this.menu.addAction(_('CPU'),
            () => this._toggleSettings('show-cpu'));
        this._memItem = this.menu.addAction(_('Memory'),
            () => this._toggleSettings('show-memory'));
        this._swapItem = this.menu.addAction(_('Swap'),
            () => this._toggleSettings('show-swap'));
        this._ulItem = this.menu.addAction(_('Upload'),
            () => this._toggleSettings('show-upload'));
        this._dlItem = this.menu.addAction(_('Download'),
            () => this._toggleSettings('show-download'));*/

        // this._notifyItem = this.menu.addAction(_('Notify'),
        //     () => this._notify("Hello"));
            // () => this._toggleSettings('notify'));

        // this._notifyItem = this.


        // this._appMenuItem = this.menu.addAction(_('Open System Monitor'),
        //     () => this._openSystemMonitor());


        // this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        // Main.panel.menuManager.addMenu(this.menu);

        //---------------------------------------------------------------
        // @ts-ignore
        // this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        // @ts-ignore
        // this._notifyItem = this.menu.addAction(_('Notify'),
        //     () => this._toggleSettings('notify'));

        // @ts-ignore
        // this._reloadLessonsItem = this.menu.addAction(_('Reload lessons'),
        //     () => this._loadLessons().then(r => this._updateLesson()));


        this._settings.connect('changed', () => this._sync());

        // this._settings.connectObject('changed',
        //     () => this._sync(), this);
        this._sync();
        if (!this._timer) {
            this._ensureTimeout();
        }
    }

    _ensureTimeout() {
        if (this._timer)
            return;

        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.get_int("update-interval"),
            () => {
                this._updateLesson();
                return GLib.SOURCE_CONTINUE;
            });
    }

    _clearTimeout() {
        if (this._timer)
            GLib.source_remove(this._timer);
        delete this._timer;
    }


    _sync() {
        // this._notifyItem.setOrnament(this._settings.get_boolean('notify')
        //     ? PopupMenu.Ornament.CHECK
        //     : PopupMenu.Ornament.NONE);
        this._clearTimeout();
        this._ensureTimeout();
    }

    async _loadLessons() {
        // const filePath = GLib.build_filenamev([GLib.get_home_dir(), ".local","share","gnome-shell","extensions/next-up-lesson-indicator@josephuspaye"]);
        // const filePath = GLib.get_home_dir() + "/.local/share/gnome-shell/extensions/next-up-lesson-indicator@liuuner.ch/lessons.js";
        // const filePath = this._settings.get_string('lessons-file');
        // const filePath = "./lessons.js";
        try {
            const module = await import("./lessons.js");
            this._lessons = module.default; // Access the default export if applicable
            // this._lessons = Lessons;
        } catch (error) {
            Main.notify("Failed to load lessons");
            throw error;
        }
    }

    _toggleSettings(key: string) {
        this._settings.set_boolean(key, !this._settings.get_boolean(key));
    }

    _notify(lesson: Lesson) {
        if (this._settings.get_boolean('notify')) {
            Main.notify("Lesson", lesson.name);
        }
    }

    getCurrentLesson() {
        let now = new Date();
        // @ts-ignore
        let dayNum = GLib.DateTime.new_now_local().get_day_of_week();
        let day = getDayName(dayNum);
        let currentTime = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });

        if (!(day in this._lessons)) return "No lessons today";

        for (let lesson of this._lessons[day]) {
            if (currentTime >= lesson.start && currentTime < lesson.end) {
                if (this._lessonBefore !== lesson) {
                    this._notify(lesson);
                    this._lessonBefore = lesson;
                }
                return `${lesson.name} ends at ${lesson.end}`;
            }
            if (currentTime < lesson.start) {
                if (this._lessonBefore !== lesson) {
                    this._notify(lesson);
                    this._lessonBefore = lesson;
                }
                return `${lesson.name} starts at ${lesson.start}`;
            }
        }
        this._lessonBefore = undefined;
        return "No more lessons today";
    }

    _updateLesson() {
        this.label.set_text(this.getCurrentLesson());
        return true;
    }

    destroy() {
        if (this._timer) GLib.source_remove(this._timer);
        // if (this._notifyItem) this._notifyItem.destroy();
        if (this.label) this.label.destroy();
        if (this._timer) this._clearTimeout();
        super.destroy();
    }
}