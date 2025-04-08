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

function getTimeDifference(targetTime: string) {
    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

    // Parse the target time (in "HH:mm" format)
    const [targetHours, targetMinutes] = targetTime.split(":").map(Number);
    const targetTimeInMinutes = targetHours * 60 + targetMinutes;

    // Calculate the difference
    return targetTimeInMinutes - currentTimeInMinutes;
}

export class LessonStatusIndicator extends PanelMenu.Button {
    label: St.Label;
    _lessonBefore: Lesson | undefined = undefined;
    _timer: number | undefined;
    _lessons: { [key: string]: Lesson[] } = {};
    // @ts-ignore
    _notifyItem: PopupMenu.PopupMenuItem;
    _reloadLessonsItem: PopupMenu.PopupMenuItem;
    _settings: Gio.Settings;

    static {
        GObject.registerClass(this);
    }

    constructor(settings: Gio.Settings) {
        super(0.0, "LessonStatusIndicator");

        this._settings = settings;

        this.label = new St.Label({
            text: this.getCurrentLesson(),
            y_align: Clutter.ActorAlign.CENTER,
            style: "font-size: 0.9em;"
        });
        this.add_child(this.label);

        this._loadLessons().then(r => this._updateLesson());

        // @ts-ignore
        this._notifyItem = this.menu.addAction(_('Notify'),
            () => this._toggleSettings('notify'));

        // @ts-ignore
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem("Actions"));

        // @ts-ignore
        this._reloadLessonsItem = this.menu.addAction(_('Reload lessons'),
            () => this._loadLessons().then(r => this._updateLesson()));


        this._settings.connect('changed', () => this._sync());

        // @ts-ignore
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
                this._lessonBefore = undefined;
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
        this._notifyItem.setOrnament(this._settings.get_boolean('notify')
            ? PopupMenu.Ornament.CHECK
            : PopupMenu.Ornament.NONE);
        this._clearTimeout();
        this._ensureTimeout();
    }

    async _loadLessons() {
        try {
            // use a cache buster to force reload
            const module = await import(`./lessons.js?cacheBuster=${Date.now()}`);
            this._lessons = module.default; // Access the default export if applicable
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
                return this.buildLessonString(lesson, "ends");
            }
            if (currentTime < lesson.start) {
                if (this._lessonBefore !== lesson) {
                    this._notify(lesson);
                    this._lessonBefore = lesson;
                }
                return this.buildLessonString(lesson, "starts");
            }
        }
        this._lessonBefore = undefined;
        return "No more lessons today";
    }

    buildLessonString(lesson: Lesson, action: "starts" | "ends") {
        const minuteThreshold = this._settings.get_int("minute-maximum");
        const targetTime = action === "starts" ? lesson.start : lesson.end;
        const timeDifference = getTimeDifference(targetTime);

        if (timeDifference > minuteThreshold) {
            return `${lesson.name} ${action} at ${targetTime}`;
        }
        if (minuteThreshold > 60) {
            const hours = Math.floor(timeDifference / 60);
            const minutes = timeDifference % 60;
            return `${lesson.name} ${action} in ${hours}h ${minutes}min`;
        }
        return `${lesson.name} ${action} in ${timeDifference}min`;
    }

    _updateLesson() {
        this.label.set_text(this.getCurrentLesson());
    }

    destroy() {
        if (this._timer) GLib.source_remove(this._timer);
        if (this._notifyItem) this._notifyItem.destroy();
        if (this.label) this.label.destroy();
        if (this._timer) this._clearTimeout();
        super.destroy();
    }
}