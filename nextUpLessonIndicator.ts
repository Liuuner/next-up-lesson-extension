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

function stringToColourAndBgColour(str: string): {
    colour: string,
    backgroundColourHex: string,
    backgroundColour: { red: number, green: number, blue: number }
} {
    let hash = 0;
    str.split('').forEach(char => {
        hash = char.charCodeAt(0) + ((hash << 5) - hash)
    })
    let backgroundColourHex = '#'

    const redValue = (hash >> (0 * 8)) & 0xff
    backgroundColourHex += redValue.toString(16).padStart(2, '0')
    const greenValue = (hash >> (1 * 8)) & 0xff
    backgroundColourHex += greenValue.toString(16).padStart(2, '0')
    const blueValue = (hash >> (2 * 8)) & 0xff
    backgroundColourHex += blueValue.toString(16).padStart(2, '0')

    const isColourBright = (redValue + greenValue + blueValue) > 510

    return {
        backgroundColourHex,
        backgroundColour: {red: redValue, green: greenValue, blue: blueValue},
        colour: isColourBright ? "black" : "white"
    }
}

function getMinutesFromTimeString(time: string) {
    const [h, m] = time.split(":");
    return (Number(h) * 60) + Number(m);
}

function startEndTimeToHeight(start: string, end: string) {
    const startMinutes = getMinutesFromTimeString(start)
    const endMinutes = getMinutesFromTimeString(end)
    const res = 34 * (endMinutes - startMinutes) / 45;
    console.debug(`Start: ${start}, End: ${end}, res: ${res}, diff: ${endMinutes - startMinutes}`)
    return res - 1; // substract border width (omg schüll het en kommentar gmacht)
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
    _redLine = new St.Widget({
        style_class: 'time-indicator',
        x_expand: true,
        y_align: Clutter.ActorAlign.START,
    });

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

        this._loadLessons().then(r => {
            this._updateLesson()
            this._insertTimetable()
        });

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
        // this._settings.connectObject('changed',y
        //     () => this._sync(), this);
        this._sync();
        if (!this._timer) {
            this._ensureTimeout();
        }
    }

    _insertTimetable() {
        const tableWrapper = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });


        // @ts-ignore
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem("Timetable"));
        const lessons = this.getCurrentDayLessons()

        const table = new St.Widget({
            style_class: 'stundenplan-table',
            layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.VERTICAL}),
            reactive: true,
        });
        tableWrapper.add_child(table)

        const layout = table.layout_manager;

        // @ts-ignore
        layout.attach(new St.Label({
            text: 'Time',
            style_class: 'stundenplan-field stundenplan-header'
        }), 0, 0, 1, 1);
        // @ts-ignore
        layout.attach(new St.Label({
            text: 'Lesson',
            style_class: 'stundenplan-field stundenplan-header'
        }), 1, 0, 1, 1);

        let row = 1;
        lessons.forEach(({start, end, name}, index, array) => {
            const height = startEndTimeToHeight(start, end);
            // @ts-ignore
            layout.attach(new St.Label({
                text: `${start}\n${end}`,
                style_class: 'stundenplan-field stundenplan-time',
                style: `height: ${height}px`
            }), 0, row, 1, 1);
            const {colour, backgroundColourHex, backgroundColour} = stringToColourAndBgColour(name);
            // @ts-ignore
            layout.attach(new St.Label({
                text: name,
                style_class: 'stundenplan-field stundenplan-lesson',
                style: `color: ${colour}; height: ${height}px; background-color: ${backgroundColourHex};`
            }), 1, row, 1, 1);

            row++;
            const nextLesson = array[index + 1]
            if (nextLesson) {
                const pauseHeight = startEndTimeToHeight(end, nextLesson.start);
                // @ts-ignore
                layout.attach(new St.Label({
                    style_class: 'stundenplan-field',
                    style: `height: ${pauseHeight}px`
                }), 0, row, 1, 1);
                // @ts-ignore
                layout.attach(new St.Label({
                    style_class: 'stundenplan-field',
                    style: `height: ${pauseHeight}px`
                }), 1, row, 1, 1);
                row++;
            }
        });

        this._insertTimetableRedLine(tableWrapper)
        this._updateTimetableRedLine()

        const item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        item.actor.add_child(tableWrapper);
        //@ts-ignore
        this.menu.addMenuItem(item);
        //@ts-ignore
        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                console.log("menu opened")
            }
        });
    }

    _insertTimetableRedLine(tableWrapper: St.Widget) {
        tableWrapper.add_child(this._redLine)

    }

    _updateTimetableRedLine() {
        let currentTime = getMinutesFromTimeString(new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }));
        const lessons = this.getCurrentDayLessons();
        const firstLessonOfDay = Math.min(...lessons.map(lesson => getMinutesFromTimeString(lesson.start)));
        const lastLessonOfDay = Math.max(...lessons.map(lesson => getMinutesFromTimeString(lesson.end)));

        if (currentTime >= firstLessonOfDay && currentTime <= lastLessonOfDay) {
            this._redLine.set_y(17 + (34 * (currentTime - firstLessonOfDay) / 45))
            this._redLine.visible = true
        } else {
            this._redLine.visible = false
        }
    }

    _ensureTimeout() {
        if (this._timer)
            return;

        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.get_int("update-interval"),
            () => {
                this._lessonBefore = undefined;
                this._updateTimetableRedLine();
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

    getCurrentDayLessons(): Lesson[] {
        let dayNum = GLib.DateTime.new_now_local().get_day_of_week();
        let day = getDayName(dayNum);

        console.log(day)
        console.log(this._lessons)

        if (!(day in this._lessons)) return [];

        return this._lessons[day];
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