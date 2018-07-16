const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const util = Me.imports.util;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Signals = imports.signals;

const INTF_XML_NAME = Me.path + "/DBusInterface.xml";
const nodeXML = String(GLib.file_get_contents(INTF_XML_NAME)[1]);
const nodeInfo = Gio.DBusNodeInfo.new_for_xml(nodeXML);
const USBGuardRootProxy = util.mkProxy(nodeInfo, "org.usbguard", "/org/usbguard");
const USBGuardPolicyProxy = util.mkProxy(nodeInfo, "org.usbguard.Policy", "/org/usbguard/Policy");
const USBGuardDevicesProxy = util.mkProxy(nodeInfo, "org.usbguard.Devices", "/org/usbguard/Devices");

var DevicePolicy = {
    ALLOW: 0,
    BLOCK: 1,
    REJECT: 2
};

var DevicePresence = {
    PRESENT: 0,
    INSERT: 1,
    UPDATE: 2,
    REMOVE: 3
};

class USBGuardInterface {

    constructor(proxy){
        this._proxy = proxy;
        this._connectSignals();
    }

    _connectSignals(){}

}

class USBGuardRoot extends USBGuardInterface {

    constructor() {
        super(USBGuardRootProxy());
    }

    _connectSignals() {
        this._proxy.connectSignal("ExceptionMessage", (proxy, sender, [context, object, reason]) => {
            util.log("[USBGuard Exception] ctx -> "+context+" obj -> "+object+" rsn -> "+reason);
        });
    }

    getParameter(key) {
        return this._proxy.getParameterSync(key);
    }

    setParameter(key, value) {
        return this._proxy.setParameterSync(key, value);
    }
    
}

class USBGuardPolicy extends USBGuardInterface {

    constructor() {
        super(USBGuardPolicyProxy());
    }

    listRules(query) {
        return this._proxy.listRulesSync(query);
    }

    appendRule(rule, parent_id) {
        return this._proxy.appendRuleSync(rule, parent_id);
    }

    removeRule(id) {
        this._proxy.removeRuleSync(id);
    }

}

class DeviceAttr {

    constructor(d){
        this.id = d["id"];
        this.name = d["name"];
        this.serial = d["serial"];
        this.via_port = d["via-port"];
        this.hash = d["hash"];
        this.parent_hash = d["parent-hash"];
        this.with_interface = d["with-interface"];
    }

    static new_from_str(id, rule) {
        const regex = /([a-z-]+) ("?[\w /=:.\+-\{\}]*"?)/gm;
        
        let m;
        let d = {id: id};

        while ((m = regex.exec(rule)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            // strip quote marks in values
            d[m[1]]=m[2].replace(/"/g, ""); 

            // sometimes the name isn't known, instead of empty, write unknown.
            // TODO: Access to product?
            if (m[1] === "name" && d[m[1]] === ""){
                d[m[1]] = "unknown";
            }
        }

        return new DeviceAttr(d);
    }
}

class USBDevice {

    constructor(id, policy, attr) {
        this.id = id;
        this.policy = policy;
        this.attr = attr;
    }

    static new_from_device_rule(device_id, device_rule) {
        let _tmp = util.split(device_rule, " ", 3);
        
        let id = _tmp[2];

        let policy;
        switch(_tmp[0]){
        case "allow":
            policy = DevicePolicy.ALLOW;
            break;
        case "block":
            policy = DevicePolicy.BLOCK;
            break;
        case "reject":
            policy = DevicePolicy.REJECT;
            break;
        default:
            policy = DevicePolicy.BLOCK;
        }

        return new USBDevice(device_id, policy, DeviceAttr.new_from_str(id, _tmp[3]));
    }
}

class USBGuardDevices extends USBGuardInterface {

    constructor() {
        super(USBGuardDevicesProxy());
    }

    _connectSignals() {
        this._proxy.connectSignal("DevicePresenceChanged", (proxy, sender, [id, event, target, device_rule, attributes]) => {
            this.emit("presence", id, event, target, USBDevice.new_from_device_rule(id, device_rule));
        });

        this._proxy.connectSignal("DevicePolicyChanged", (proxy, sender, [id, target_old, target_new, device_rule, rule_id, attributes]) => {
            this.emit("policy-change", id, target_old, target_new, USBDevice.new_from_device_rule(id, device_rule), rule_id);
        });
    }

    listDevices(query) {
        let res = {};
        this._proxy.listDevicesSync(query)[0].forEach(function(result){
            let device_id = result[0];
            let device_rule = result[1];
            res[device_id] = USBDevice.new_from_device_rule(device_id, device_rule);
        });
        return res;
    }

    applyDevicePolicy(id, target, permanent) {
        return this._proxy.applyDevicePolicySync(id, target, permanent);
    }
}

Signals.addSignalMethods(USBGuardDevices.prototype);


class USBGuard {

    constructor() {
        this.root = new USBGuardRoot();
        this.policy = new USBGuardPolicy();
        this.devices = new USBGuardDevices();
    }

    _applyPolicy(device, policy, permanent) {
        device.policy = policy;
        this.devices.applyDevicePolicy(device.id, policy, permanent);
    }

    allow(device, permanent) {
        this._applyPolicy(device, DevicePolicy.ALLOW, permanent);
    }

    block(device, permanent) {
        this._applyPolicy(device, DevicePolicy.BLOCK, permanent);
    }

    reject(device, permanent) {
        this._applyPolicy(device, DevicePolicy.REJECT, permanent);
    }
}
