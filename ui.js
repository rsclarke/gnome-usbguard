const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;

const INACTIVE = "usbguard-icon-inactive"
const WARNING = "usbguard-icon-warning"
const CONNETED = "usbguard-icon"

class USBGuardButton extends PanelMenu.Button {
    
    constructor() {
        super(null, "GNOMEUSBGuard");
        this.usbguardIcon = new St.Icon({
            icon_name: INACTIVE,
            style_class: 'system-status-icon'
        });
        this.panelicon = this.actor.add_actor(this.usbguardIcon);
        this.actor.show();
    }
}