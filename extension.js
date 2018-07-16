const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const USBGuard = Me.imports.usbguard;
const util = Me.imports.util;
const USBGuardButton = Me.imports.ui.USBGuardButton;

const Gio = imports.gi.Gio;
const Main = imports.ui.main;

class GNOMEUSBGuard {
    
    constructor() {
        this.devices = {};
        this.usbguard = null;
        this.ui = new USBGuardButton();
    }

    connect() {
        this.usbguard = new USBGuard.USBGuard();

        // Get an initial list of devices.
        this.devices = this.usbguard.devices.listDevices("match");

        for(var id in this.devices){
            util.log(this.devices[id].attr.name);
        }

        this.usbguard.devices.connect("presence", (_, id, event, target, device) => {
            switch(event){
            case USBGuard.DevicePresence.PRESENT:
            case USBGuard.DevicePresence.INSERT:
            case USBGuard.DevicePresence.UPDATE:
                this.devices[id] = device;
                break;
            case USBGuard.DevicePresence.REMOVE:
                delete this.devices[id];
                break;
            default:
                util.log("Shouldn't happen");
            }
        });

        this.usbguard.devices.connect("policy-change", (_, id, target_old, target_new, device, rule_id) => {
            util.log(id);
            // Update state on toggle switch and in devices array
        });
    }

}

let gnome_usbguard;

function init() {
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(Me.path + "/icons");
}

function enable() {
    gnome_usbguard = new GNOMEUSBGuard();
    util.log("Adding UI to status area");
    Main.panel.addToStatusArea("GNOMEUSBGuard", gnome_usbguard.ui);
    try{
        gnome_usbguard.connect();
    } catch(err){
        if (err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.DBUS_ERROR)){
            util.log("Unable to connect to DBUS");
            // Notify user, set icon to inactive, menu item to reconnect.
        }
    }
}

function disable() {
    util.log("Disabling");
    gnome_usbguard.ui.destroy();
    gnome_usbguard = null;
    //gnome_usbguard.disable();
}
