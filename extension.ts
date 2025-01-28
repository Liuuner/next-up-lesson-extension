import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import {LessonStatusIndicator} from "./nextUpLessonIndicator.js";

export default class MyExtension extends Extension {
    gsettings?: Gio.Settings
    _lessonIndicator: LessonStatusIndicator | undefined

    enable() {
        this.gsettings = this.getSettings();
        this._lessonIndicator = new LessonStatusIndicator(this.gsettings);

        const index = Main.sessionMode.panel.left.indexOf('activities') + 1;
        Main.panel.addToStatusArea(this.metadata.uuid, this._lessonIndicator, index, 'left');
    }

    disable() {
        this.gsettings = undefined;
        if (this._lessonIndicator) {
            this._lessonIndicator.destroy();
        }
        delete this._lessonIndicator;
    }
}