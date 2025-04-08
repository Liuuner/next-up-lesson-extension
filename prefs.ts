import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GnomeRectanglePreferences extends ExtensionPreferences {
    _settings?: Gio.Settings

    fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        this._settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            iconName: 'dialog-information-symbolic',
        });

        const notifyGroup = new Adw.PreferencesGroup({
            title: _('Notifications'),
            // description: _('Configure move/resize animation'),
        });
        page.add(notifyGroup);

        const notificationsEnabled = new Adw.SwitchRow({
            title: _('Enabled'),
            subtitle: _('Wether to notify you'),
        });
        notifyGroup.add(notificationsEnabled);

        const paddingGroup = new Adw.PreferencesGroup({
            title: _('Minutes Threshold'),
            description: _('Threshold from which it starts to "in x minutes" instead of "at hh:mm"'),
        });
        page.add(paddingGroup);

        const paddingInner = new Adw.SpinRow({
            title: _('Minutes'),
            // subtitle: _(''),
            adjustment: new Gtk.Adjustment({
                lower: -1,
                upper: 1440,
                stepIncrement: 10
            })
        });
        paddingGroup.add(paddingInner);

        window.add(page)

        this._settings!.bind('notify', notificationsEnabled, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings!.bind('minute-maximum', paddingInner, 'value', Gio.SettingsBindFlags.DEFAULT);

        return Promise.resolve();
    }
}