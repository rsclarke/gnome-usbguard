const Gio = imports.gi.Gio;

// Utility function from Gio.js but strips the xml part
function proxyWrapperFromInterface(interfaceInfo){
    return function(bus, name, object, asyncCallback, cancellable) {
        var obj = new Gio.DBusProxy({ g_connection: bus,
                                      g_interface_name: interfaceInfo.name,
                                      g_interface_info: interfaceInfo,
                                      g_name: "org.usbguard",
                                      g_object_path: object });
        if (!cancellable)
            cancellable = null;
        if (asyncCallback)
            obj.init_async(GLib.PRIORITY_DEFAULT, cancellable, function(initable, result) {
                let caughtErrorWhenInitting = null;
                try {
                    initable.init_finish(result);
                } catch(e) {
                    caughtErrorWhenInitting = e;
                }

                if (caughtErrorWhenInitting === null) {
                    asyncCallback(initable, null);
                } else {
                    asyncCallback(null, caughtErrorWhenInitting);
                }
            });
        else
            obj.init(cancellable);
        return obj;
    };
}

function mkProxy(node, intf, path){
    let info = node.lookup_interface(intf);
    let wrapper = proxyWrapperFromInterface(info);
    return function (){
        return wrapper(Gio.DBus.system, intf, path);
    }
}

function split(string, delimiter, n) {
    var parts = string.split(delimiter);
    return parts.slice(0, n).concat([parts.slice(n).join(delimiter)]);
}

function log(msg){
    global.log("[gnome-usbguard] " + msg);
}