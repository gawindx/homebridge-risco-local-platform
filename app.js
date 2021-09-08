'use strict';

const riscoZoneDevice = require('./lib/RiscoZoneDevices');
const riscoOutputDevice = require('./lib/RiscoOutputDevices').RiscoCPOutputs;
const riscoPartDevice = require('./lib/RiscoPartDevices').RiscoCPPartitions;
const riscoSystemDevice = require('./lib/RiscoPartDevices').RiscoCPSystem;
const riscoCombinedDevice = require('./lib/RiscoCombinedDevices');
const RiscoTCPPanel = require('risco-lan-bridge');

var pjson = require('./package.json');
let Manufacturer = 'Gawindx';
const pluginName = 'homebridge-risco-local-platform';
const platformName = 'RiscoLocalAlarm';

let hap;
let Service, Characteristic, UUIDGen;

class RiscoLanPlatform {
    constructor(log, config, api) {
        //Types of Custom Detector
        this.Custom_Types = [   'Detector',
                                'Door',
                                'Window',
                                'Contact Sensor',
                                'Vibrate Sensor',
                                'Smoke Sensor',
                                'Water Sensor',
                                'Gas Sensor',
                                'CO Sensor',
                                'Temperature Sensor'
                            ];
        //Service Associated to Custom Types
        this.Custom_Types_Services = {
            'Detector': Service.MotionSensor,
            'Door': Service.Door,
            'Window': Service.Window,
            'Contact Sensor': Service.ContactSensor,
            'Vibrate Sensor': Service.MotionSensor,
            'Smoke Sensor': Service.SmokeSensor,
            'Water Sensor': Service.LeakSensor,
            'Gas Sensor': Service.CarbonDioxideSensor,
            'CO Sensor': Service.CarbonMonoxideSensor,
            'Temperature Sensor': Service.TemperatureSensor,
        };
        //Classes Associated to Custom Types
        this.Custom_Types_Classes = {
            'Detector': 'RiscoCPDetectors',
            'Door': 'RiscoCPCDoor',
            'Window': 'RiscoCPCWindow',
            'Contact Sensor': 'RiscoCPCContactSensor',
            'Vibrate Sensor': 'RiscoCPCVibrateSensor',
            'Smoke Sensor': 'RiscoCPCSmokeSensor',
            'Water Sensor': 'RiscoCPWaterSensor',
            'Gas Sensor': 'RiscoCPGasSensor',
            'Co Sensor': 'RiscoCPCoSensor',
            'Temperature Sensor': 'RiscoCPTempSensor',
        }
        //Types Of Combined Accessoies
        this.Combined_Types = [ 'Combined_GarageDoor',
                                'Combined_Door',
                                'Combined_Window'
                            ];
        //Service Associated to Combined Types
        this.Combined_Types_Services = {
            'Combined_GarageDoor': Service.GarageDoorOpener,
            'Combined_Door': Service.Door,
            'Combined_Window': Service.Window
        };
        //Classes Associated to Combined Types
        this.Combined_Types_Classes = {
            'Combined_GarageDoor': 'RiscoCPCombGarageDoor',
            'Combined_Door': 'RiscoCPCombDoor',
            'Combined_Window': 'RiscoCPCombWindows'
        }
        if (!api || !config) return;

        this.accessories = [];
        this.log = log;
        this.Config = config;
        this.api = api;

        this.PanelOptions = {
            Panel_IP: ((this.Config['Panel_IP'] !== undefined) ? this.Config['Panel_IP'] : undefined),
            Panel_Port: ((this.Config['Panel_Port'] !== undefined) ? this.Config['Panel_Port'] : undefined),
            Panel_Password: ((this.Config['Panel_Password'] !== undefined) ? this.Config['Panel_Password'] : 5678),
            Panel_Key: ((this.Config['Panel_Key'] !== undefined) ? this.Config['Panel_Key'] : 1),
            log: this.log
        };
        this.Panel_Model = ((this.Config['Panel_Model'] !== undefined) ? this.Config['Panel_Model'] : undefined);

        if ((this.PanelOptions.Panel_IP == undefined ) || (this.PanelOptions.Panel_Port == undefined ) || (this.Panel_Model == undefined )) {
            this.log.error('Missing Parameter for Initialising Panel');
            return;
        }

        this.Partitions = ((this.Config['Partitions'] !== undefined) ? this.Config['Partitions'] : 'all');
        this.Detectors = ((this.Config['Detectors'] !== undefined) ? this.Config['Detectors'] : 'all');
        this.Outputs = ((this.Config['Outputs'] !== undefined) ? this.Config['Outputs'] : 'all');
        this.SystemMode = ((this.Config['SystemMode'] !== undefined) ? this.Config['SystemMode'] : false);
        this.AddPanel2FirstPart = ((this.Config['AddPanel2FirstPart'] !== undefined) ? this.Config['AddPanel2FirstPart'] : true);
        this.Custom = ((this.Config['Custom'] !== undefined) ? this.Config['Custom'] : 'none');
        this.DiscoveredAccessories = {};
        this.Devices = [];
        this.DiscoveryFinished = false;
        this.hasCachedAccessory = false;
        this.PanelReady = false;

        switch (this.Panel_Model) {
            case 'agility':
                this.log.info('Initialising Agility Panel');
                this.RiscoPanel = new RiscoTCPPanel.Agility(this.PanelOptions);
                break;
            case 'wicomm':
                this.log.info('Initialising Wicomm Panel');
                this.RiscoPanel = new RiscoTCPPanel.WiComm(this.PanelOptions);
                break;
            case 'wicommpro':
                this.log.info('Initialising WicommPro Panel');
                this.RiscoPanel = new RiscoTCPPanel.WiCommPro(this.PanelOptions);
                break;
            case 'lightsys':
                this.log.info('Initialising LightSys Panel');
                this.RiscoPanel = new RiscoTCPPanel.LightSys(this.PanelOptions);
                break;
            case 'prosysplus':
                this.log.info('Initialising ProSysPlus Panel');
                this.RiscoPanel = new RiscoTCPPanel.ProsysPlus(this.PanelOptions);
                break;
            case 'gtplus':
                this.log.info('Initialising GTPlus Panel');
                this.RiscoPanel = new RiscoTCPPanel.GTPlus(this.PanelOptions);
                break;
        }
        this.log.info('Initial Discovery Phase');
        this.RiscoPanel.on('SystemInitComplete', () => {
            this.log.info('RiscoPanel Initialised');
            this.PanelReady = true;
        });

        api.on('didFinishLaunching', async () => {
            do {
                await new Promise(r => setTimeout(r, 5000)); 
            } while (!this.PanelReady);
            this.log.info('Accessories Init Phase Started');
            const NotUSeDetectorType = ['0', '11', '13', '16', '17', '19', '21', '22', '23', '33', '34', '35'];

            let UsuableZones = this.RiscoPanel.Zones.filter(zone => 
                (!zone.NotUsed) && (!NotUSeDetectorType.includes(zone.Type)));
            this.DiscoveredAccessories.Detectors = this.PreInitDetector(UsuableZones);
            this.log.debug(`Found ${UsuableZones.length} Zone(s)`);
            
            let UsuableOutputs = this.RiscoPanel.Outputs.filter(output => 
                (output.UserUsuable));
            this.DiscoveredAccessories.Outputs = this.PreInitOutput(UsuableOutputs);
            this.log.debug(`Found ${UsuableOutputs.length} Output(s)`);

            let UsuablePartitions = this.RiscoPanel.Partitions.filter(partition => 
                (partition.Exist));
            this.DiscoveredAccessories.Partitions = this.PreInitPartition(UsuablePartitions);
            this.log.debug(`Found ${UsuablePartitions.length} Partition(s)`);

            if (( this.Custom != 'none') && (this.DiscoveredAccessories.Detectors !== undefined)) {
                this.log.info('Apply Custom Configuration');
                for (var Custom_Type in this.Custom_Types) {
                    this.log(`Modify Detectors to ${this.Custom_Types[Custom_Type]}`);
                    if ((this.Custom[this.Custom_Types[Custom_Type]] || 'none') != 'none') {
                        if (this.Custom[this.Custom_Types[Custom_Type]] == 'all') {
                            for (var Detector in this.DiscoveredAccessories.Detectors) {
                                this.DiscoveredAccessories.Detectors[Detector].accessorytype = this.Custom_Types[Custom_Type];
                            }
                        } else if (this.Custom[this.Custom_Types[Custom_Type]] != (this.Custom[this.Custom_Types[Custom_Type]].split(',')) || ( parseInt(this.Custom[this.Custom_Types[Custom_Type]]) != NaN )) {
                            const Modified_Detectors = this.Custom[this.Custom_Types[Custom_Type]].split(',').map(function(item) {
                                return parseInt(item, 10);
                            });
                            Object.values(Modified_Detectors).forEach( Id_Detector => {
                                this.log.debug('Detector Name/Id: %s/%s Modified to %s', this.DiscoveredAccessories.Detectors[Id_Detector].name, this.DiscoveredAccessories.Detectors[Id_Detector].Id, this.Custom_Types[Custom_Type]);
                                this.DiscoveredAccessories.Detectors[Id_Detector].accessorytype = this.Custom_Types[Custom_Type];
                            });
                        }
                    }
                }
            }
            if (((this.Config['Combined'] || 'none') != 'none') && (this.DiscoveredAccessories.Detectors !== undefined) && (this.DiscoveredAccessories.Outputs !== undefined)) {
                this.DiscoveredAccessories.Combineds = this.PreInitCombined(this.Config['Combined'], UsuableZones, UsuableOutputs);
                this.log.info(`Creation of ${Object.keys(this.DiscoveredAccessories.Combineds).length} Combined Accessories`);
            }

            this.log.info('PreConf Phase Started');
            try {
                if (Object.keys(this.DiscoveredAccessories).length != 0) {
                    for (var DeviceFamily in this.DiscoveredAccessories) {
                        this.PreConfigureAccessories(DeviceFamily);
                    }
                    this.DiscoveryFinished = true;
                }
            } catch (err) {
                this.log.error(`Error on PreConf Phase: ${err}`);
            }
            this.log.info('PreConf Phase Ended');

            this.log.info('Create Accessory Phase Started');
            try {
                if (Object.keys(this.DiscoveredAccessories).length != 0) {
                    if (this.hasCachedAccessory) {
                        await new Promise(r => setTimeout(r, 5000));
                    }
                    for (var DiscoveredAcc in this.Devices) {
                        if ( this.Devices[DiscoveredAcc].context !== undefined ) {
                            this.addAccessory(this.Devices[DiscoveredAcc]);
                        }
                    }
                    this.RiscoPanel.Ready = true;
                }
            } catch (err) {
                this.log.error(`Error on Create Accessory Phase :\n ${err}`);
            }
            this.log.info('Accessories Init Phase Ended');

            // Prune Unused accessories
            if (this.RiscoPanel.Ready) {
                for (const accessory of this.accessories) {
                    if ((accessory.context.todelete !== undefined) && (accessory.context.todelete === true)) {
                        this._removeAccessory(accessory);                        
                    }
                }
            }
        });
    }

    configureAccessory(accessory) {
        this.hasCachedAccessory = true;
        accessory.on('identify', function accidentify() {
            this.log.debug(`${accessory.displayName} identified!`);
            //avoid warning on maxEventListener
            accessory.removeListener('identify', accidentify);
        });
        if (this.DiscoveryFinished) {
            var KeepAccessory = false;
            this.log.info(`Restoring or Set Removing accessory ${accessory.displayName}`);
            this.Devices.filter(new_device => ((new_device.context.longName == accessory.context.longName) && (new_device.context.Required == true)))
                .map(new_device => {
                    this._addOrConfigure(accessory, new_device, accessory.context.accessorytype, false);
                    KeepAccessory = true;
                });
            this.accessories.push(accessory);
            this.api.updatePlatformAccessories([accessory]);
            if (!(KeepAccessory)) {
                this.log.debug(`Set to Remove accessory ${accessory.displayName}`);
                accessory.context.todelete = true;
            }
        } else {
            setTimeout(this.configureAccessory.bind(this, accessory), 1000);
        }
    }

    addAccessory(DiscoveredAcc) {
        let uuid = UUIDGen.generate(DiscoveredAcc.context.longName);
        let accessory = new this.api.platformAccessory(DiscoveredAcc.context.name, uuid);
        accessory.context = DiscoveredAcc.context;
        if ((this.accessories.filter(device => (device.UUID == uuid))).length == 0) {
            this.log.info(`Adding new accessory with Name: ${DiscoveredAcc.context.name}, Id: ${DiscoveredAcc.context.Id}, type: ${DiscoveredAcc.context.accessorytype}`);
            this._addOrConfigure(accessory, DiscoveredAcc, DiscoveredAcc.context.accessorytype, true);
            this.accessories.push(accessory);
            this.api.registerPlatformAccessories(pluginName, platformName, [accessory]);
        }
    }

    _addOrConfigure(accessory, object, type, add) {
        if (type !== object.context.accessorytype) {
            this.log.debug(`Accessory: ${object.context.name} Modified Since Last Run`);
            add = true;
            if (this.Custom_Types.includes(type)) {
                accessory.removeService(accessory.getService(this.Custom_Types_Services[type]));
            } else if (this.Combined_Types.includes(type)) {
                accessory.removeService(accessory.getService(this.Combined_Types_Services[type]));
            }
            accessory.context.accessorytype = type = object.context.accessorytype;
        }

        if ((add) ||  (accessory.getService(Service.AccessoryInformation) === undefined)) {
            this.log.debug(`AddOrConfigure Accessory: ${object.context.name}`);
            accessory.getService(Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Name, object.context.name)
                .setCharacteristic(Characteristic.Identify, object.context.name)
                .setCharacteristic(Characteristic.Manufacturer, Manufacturer)
                .setCharacteristic(Characteristic.Model, object.context.longName)
                .setCharacteristic(Characteristic.SerialNumber, pjson.version)
                .setCharacteristic(Characteristic.FirmwareRevision, pjson.version);
        }

        if ((accessory.getService(Service.AccessoryInformation).getCharacteristic(Characteristic.SerialNumber).value) != pjson.version) {
            //do some stuff on update accessory from older version of plugin
            accessory.getService(Service.AccessoryInformation)
                .setCharacteristic(Characteristic.SerialNumber, pjson.version)
                .setCharacteristic(Characteristic.FirmwareRevision, pjson.version);
        }

        switch (type) {
            case 'System':
                if (add) {
                    accessory.addService(Service.SecuritySystem, accessory.context.name);
                    accessory.addService(Service.OccupancySensor, `Occupancy ${accessory.displayName}`, `occupancy_${accessory.context.name}`);
                    if (this.AddPanel2FirstPart && (accessory.context.MBObj !== undefined)) {
                        accessory.addService(Service.Battery, `Battery ${accessory.displayName}`, `battery_${accessory.context.name}`);
                    }
                } else {
                    this.log.info(`Configuring accessory ${accessory.displayName}`);
                    if (accessory.getService(Service.OccupancySensor) === undefined ){
                        this.log.debug(`Occupancy Service not already defined on accessory ${accessory.displayName}`);
                        this.log.error(`Occupancy Service not already defined on accessory ${accessory.displayName}`);
                        accessory.addService(Service.OccupancySensor, `Occupancy ${accessory.displayName}`, `occupancy_${accessory.context.name}`);
                    }
                    if (this.AddPanel2FirstPart && (accessory.context.MBObj !== undefined)) {
                        if (accessory.getService(Service.Battery) === undefined ) {
                            this.log.debug(`Service Battery not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(Service.Battery, `Battery ${accessory.displayName}`, `battery_${accessory.context.name}`);
                        }
                    } else {
                        if (accessory.getService(Service.Battery) !== undefined ) {
                            this.log.debug(`Service Battery already defined on accessory ${accessory.displayName}`);
                            this.log.debug('This service is not required anymore ; remove it');
                            accessory.removeService(accessory.getService(Service.Battery));
                        }
                    }
                }
                new riscoSystemDevice(this.log, object, this.api, accessory);
                break;
            case 'Partitions':
                if (add) {
                    accessory.addService(Service.SecuritySystem, accessory.context.name);
                    accessory.addService(Service.OccupancySensor, `Occupancy ${accessory.displayName}`, `occupancy_${accessory.context.name}`);
                    if (this.AddPanel2FirstPart && (accessory.context.MBObj !== undefined)) {
                        accessory.addService(Service.Battery, `Battery ${accessory.displayName}`, `battery_${accessory.context.name}`);
                    }
                } else {
                    this.log.info(`Configuring accessory ${accessory.displayName}`);
                    if (accessory.getService(Service.OccupancySensor) === undefined ){
                        this.log.debug(`Occupancy Service not already defined on accessory ${accessory.displayName}`);
                        this.log.error(`Occupancy Service not already defined on accessory ${accessory.displayName}`);
                        accessory.addService(Service.OccupancySensor, `Occupancy ${accessory.displayName}`, `occupancy_${accessory.context.name}`);
                    }
                    if (this.AddPanel2FirstPart && (accessory.context.MBObj !== undefined)) {
                        if (accessory.getService(Service.Battery) === undefined ) {
                            this.log.debug(`Service Battery not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(Service.Battery, `Battery ${accessory.displayName}`, `battery_${accessory.context.name}`);
                        }
                    } else {
                        if (accessory.getService(Service.Battery) !== undefined ) {
                            this.log.debug(`Service Battery already defined on accessory ${accessory.displayName}`);
                            this.log.debug('This service is not required anymore ; remove it');
                            accessory.removeService(accessory.getService(Service.Battery));
                        }
                    }
                }
                new riscoPartDevice(this.log, object, this.api, accessory);
                break;
            case 'Outputs':
                if (add) {
                    accessory.addService(Service.Switch, accessory.context.name);
                } else {
                    this.log.info(`Configuring accessory ${accessory.displayName}_${type}`);
                }
                new riscoOutputDevice(this.log, object, this.api, accessory);
                break;
            case 'detector':
            default:
                if (this.Custom_Types.includes(type)) {
                    if (add) {
                        this.log.info(`Add or Modifying accessory ${accessory.displayName}`);
                        for (var AccTypes in this.Custom_Types_Services) {
                            if ((AccTypes != type) && (accessory.getService(this.Custom_Types_Services[AccTypes]) !== undefined)) {
                                this.log.debug(`Service ${AccTypes} already defined on accessory ${accessory.displayName}`);
                                this.log.debug('This service is not required anymore ; remove it');
                                accessory.removeService(accessory.getService(this.Custom_Types_Services[AccTypes]));
                            }
                        }
                        if (accessory.getService(this.Custom_Types_Services[type]) === undefined ) {
                            this.log.debug(`Service ${type} not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(this.Custom_Types_Services[type], accessory.context.name);
                            //remove also ExcludeSwitch because he became first Service
                            if (accessory.getService(`Exclude ${accessory.displayName}`) !== undefined ) {
                                this.log.debug(`Service Exclude already defined on accessory ${accessory.displayName}`);
                                this.log.debug('Remove it to avoid he became first Service');
                                accessory.removeService(accessory.getService(`Exclude ${accessory.displayName}`));
                            }
                            if ((accessory.getService(`Battery ${accessory.displayName}`) === undefined ) || (!accessory.context.IsWireless)) {
                                this.log.debug(`Service Battery already defined or unnecessary on accessory ${accessory.displayName}`);
                                this.log.debug('Remove it to avoid he became first Service');
                                accessory.removeService(accessory.getService(`Battery ${accessory.displayName}`));
                            }
                        }
                        if (accessory.getService(Service.Switch) === undefined ) {
                            this.log.debug(`Service Exclude not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(Service.Switch, `Exclude ${accessory.displayName}`, `exclude_${accessory.context.name}`);
                        }
                        if ((accessory.getService(Service.Battery) === undefined ) && (accessory.context.IsWireless)) {
                            this.log.debug(`Service Battery not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(Service.Battery, `Battery ${accessory.displayName}`, `battery_${accessory.context.name}`);
                        }
                    } else {
                        this.log.info(`Configuring accessory ${accessory.displayName}`);
                        if (accessory.getService(Service.Switch) === undefined ) {
                            this.log.debug(`Service Exclude not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(Service.Switch, `Exclude ${accessory.displayName}`, `exclude_${accessory.context.name}`);
                        }
                        if ((accessory.getService(Service.Battery) === undefined ) && (accessory.context.IsWireless)) {
                            this.log.debug(`Service Battery not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(Service.Battery, `Battery ${accessory.displayName}`, `battery_${accessory.context.name}`);
                        }
                    }
                    new riscoZoneDevice[this.Custom_Types_Classes[type]](this.log, object, this.api, accessory);
                } else if (this.Combined_Types.includes(type)) {
                    if (add) {
                        this.log.info(`Add or Modifying Combined accessory ${accessory.displayName}`);
                        for (var AccTypes in this.Combined_Types_Services) {
                            if ((AccTypes != type) && (accessory.getService(this.Combined_Types_Services[AccTypes]) !== undefined)) {
                                this.log.debug(`Service ${this.Combined_Types_Services[AccTypes]} already defined on accessory ${accessory.displayName}`);
                                this.log.debug('This service is not required anymore ; remove it');
                                accessory.removeService(accessory.getService(this.Combined_Types_Services[AccTypes]));
                            }
                        }
                        if (accessory.getService(this.Combined_Types_Services[type]) === undefined ) {
                            this.log.debug(`Service ${type} not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(this.Combined_Types_Services[type], accessory.context.name);
                            //remove also ExcludeSwitch because he became first Service
                            if (accessory.getService(`Exclude ${accessory.displayName}`) !== undefined ) {
                                this.log.debug(`Service Exclude already defined on accessory ${accessory.displayName}`);
                                this.log.debug('Remove it to avoid he became first Service');
                                accessory.removeService(accessory.getService(`Exclude ${accessory.displayName}`));
                            }
                            if ((accessory.getService(`Battery ${accessory.displayName}`) === undefined ) || (!accessory.context.InObj.IsWireless)) {
                                this.log.debug(`Service Battery already defined or unnecessary on accessory ${accessory.displayName}`);
                                this.log.debug('Remove it to avoid he became first Service');
                                accessory.removeService(accessory.getService(`Battery ${accessory.displayName}`));
                            }
                        }
                        if (accessory.getService(Service.Switch) === undefined ) {
                            this.log.debug(`Service Exclude not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(Service.Switch, `Exclude ${accessory.displayName}`, `exclude_${accessory.context.name}`);
                        }
                        if ((accessory.getService(Service.Battery) === undefined ) && (accessory.context.InObj.IsWireless)) {
                            this.log.debug(`Service Battery not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(Service.Battery, `Battery ${accessory.displayName}`, `battery_${accessory.context.name}`);
                        }
                    } else {
                        this.log.info(`Configuring Combined accessory ${accessory.displayName}`);
                        if (accessory.getService(Service.Switch) === undefined ) {
                            this.log.debug(`Service Exclude not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(Service.Switch, `Exclude ${accessory.displayName}`, `exclude_${accessory.context.name}`);
                        }
                        if ((accessory.getService(Service.Battery) === undefined ) && (accessory.context.InObj.IsWireless)) {
                            this.log.debug(`Service Battery not already defined on accessory ${accessory.displayName}`);
                            accessory.addService(Service.Battery, `Battery ${accessory.displayName}`, `battery_${accessory.context.name}`);
                        }
                    }
                    new riscoCombinedDevice[this.Combined_Types_Classes[type]](this.log, object, this.api, accessory);
                }
                break;
        };
    }

    _removeAccessory(accessory) {
         this.log.info(`Removing accessory ${accessory.displayName}`);
         this.api.unregisterPlatformAccessories(pluginName, platformName, [accessory]);
    }

    PreInitDetector(Array_Detector) {
        let PreConfArray = Array.from(Array_Detector);
        var Detectors_Datas = {};
        var DetectorsInfos = ( () => {
            Object.values(PreConfArray)
                .forEach( detector => {
                    const DetectorName = detector.Label;
                    const AccessoryType = (() => {
                        const DetectorTypeList = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '15', '18', '20', '25', '26'];
                        if (DetectorTypeList.includes(detector.Type)) {
                            return 'Detector';
                        } else {
                            switch (detector.Type) {
                                case '14' :
                                    return 'Smoke Sensor';
                                case '24' :
                                    return 'Contact Sensor';
                                case '27':
                                    return 'Water Sensor';
                                case '28':
                                    return 'Gas Sensor';
                                case '29':
                                    return 'CO Sensor';
                                case '31':
                                case '32':
                                    return 'Temperature Sensor';
                                default:
                                    return 'Detector';
                            }
                        }
                    })();
                    var Detector_Data = {
                        Id: detector.Id,
                        Required: false,
                        accessorytype: AccessoryType,
                        name: DetectorName,
                        ObjInst: detector,
                        IsWireless: ((detector.ZTech == 'Wireless Zone') ? true : false),
                        longName: `det_${detector.Id}_${(DetectorName.toLowerCase()).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '_')}`,
                        };
                    this.log.debug(`Discovering Detector : "${Detector_Data.name}" with Id: ${Detector_Data.Id}`);
                    Detectors_Datas[detector.Id] = Detector_Data;
                });
            if (this.Detectors == 'all') {
                this.log.debug('All Detectors Required');
                Object.values(Detectors_Datas)
                    .forEach( detector => {
                        Detectors_Datas[detector.Id].Required = true;
                    });
            } else if (this.Detectors != (this.Detectors.split(',')) || (parseInt(this.Detectors) != NaN)) {
                this.log.debug('Not All Detectors Required');
                //Automatically convert string value to integer
                const Required_Detectors = this.Detectors.split(',').map( (item) => {
                    return parseInt(item, 10);
                });
                Object.values(Detectors_Datas)
                    .filter( detector => (Required_Detectors.includes(detector.Id) !== false))
                    .map( detector => {
                        Detectors_Datas[detector.Id].Required = true;
                        this.log.debug(`Detector "${detector.name}" Required`);
                    });
            } else {
                this.log.debug('No Detectors Required');
            }
            return Detectors_Datas;
        })();
        this.log.info(`Discovered ${Object.keys(DetectorsInfos).length} Detector(s)`);
        return DetectorsInfos;
    }

    PreInitOutput(Array_Output) {
        let PreConfArray = Array.from(Array_Output);
        var Outputs_Datas = {};
        var OutputsInfos = ( () => {
            Object.values(PreConfArray)
                .forEach( output => {
                    const OutputName = output.Label;
                    var Output_Data = {
                        Id: output.Id,
                        Required: false,
                        accessorytype: 'Outputs',
                        name: OutputName,
                        ObjInst: output,
                        Type: ( () => {
                            if (output.Pulsed) {
                                return 'pulsed';
                            } else {
                                return 'switch';
                            }
                        })(),
                        State: ( () => {
                            if (output.Pulsed) {
                                return false;
                            } else {
                                return output.Active;
                            }
                        })(),                        
                        longName: `out_${output.Id}_${(OutputName.toLowerCase()).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '_')}`,
                        };
                    this.log.debug(`Discovering Output : "${Output_Data.name}" with Id: ${Output_Data.Id}`);
                    Outputs_Datas[output.Id] = Output_Data;
                });
            if (this.Outputs == 'all') {
                this.log.debug('All Outputs Required');
                Object.values(Outputs_Datas)
                    .forEach( output => {
                        Outputs_Datas[output.Id].Required = true;
                    });
            } else if (this.Outputs != (this.Outputs.split(',')) || (parseInt(this.Outputs) != NaN)) {
                this.log.debug('Not All Outputs Required');
                //Automatically convert string value to integer
                const Required_Outputs = this.Outputs.split(',').map( (item) => {
                    return parseInt(item, 10);
                });
                Object.values(Outputs_Datas)
                    .filter( output => (Required_Outputs.includes(output.Id) !== false))
                    .map( output => {
                        Outputs_Datas[output.Id].Required = true;
                        this.log.debug(`Output "${output.name}" Required`);
                    });
            } else {
                this.log.debug('No Outputs Required');
            }
            return Outputs_Datas;
        })();
        this.log.info(`Discovered ${Object.keys(OutputsInfos).length} Output(s)`);
        return OutputsInfos;
    }

    PreInitPartition(Array_Partition) {
        let PreConfArray = Array.from(Array_Partition);
        var Partitions_Datas = {};
        var PartitionsInfos = ( () => {
            Object.values(PreConfArray)
                .forEach( partition => {
                    const PartitionName = partition.Label;
                    var Partition_Data = {
                        Id: partition.Id,
                        Required: false,
                        accessorytype: 'Partitions',
                        name: PartitionName,
                        ObjInst: partition,
                        MBObj: ( () => {
                            if ((this.AddPanel2FirstPart) && (Object.keys(Partitions_Datas).length == 0)) {
                                return this.RiscoPanel.MBSystem;
                            } else {
                                return undefined;
                            }
                        })(),
                        longName: `part_${partition.Id}_${(PartitionName.toLowerCase()).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '_')}`,
                        };
                    this.log.debug(`Discovering Partition : "${Partition_Data.name}" with Id: ${Partition_Data.Id}`);
                    Partitions_Datas[partition.Id] = Partition_Data;
                });
            if (this.Partitions == 'all') {
                this.log.debug('All Partitions Required');
                Object.values(Partitions_Datas)
                    .forEach( partition => {
                        Partitions_Datas[partition.Id].Required = true;
                    });
            } else if (this.Partitions != (this.Partitions.split(',')) || (parseInt(this.Partitions) != NaN)) {
                this.log.debug('Not All Partitions Required');
                //Automatically convert string value to integer
                const Required_Partitions = this.Partitions.split(',').map( (item) => {
                    return parseInt(item, 10);
                });
                Object.values(Partitions_Datas)
                    .filter( partition => (Required_Partitions.includes(partition.Id) !== false))
                    .map( partition => {
                        Partitions_Datas[partition.Id].Required = true;
                        this.log.debug(`Partition "${partition.name}" Required`);
                    });
            } else {
                this.log.debug('No Partitions Required');
            }
            return Partitions_Datas;
        })();
        this.log.info(`Discovered ${Object.keys(PartitionsInfos).length} Partition(s)`);
        return PartitionsInfos;
    }

    PreInitCombined(Combined_Array, UsuableIn, UsuableOut) {
        this.log.debug('Combined accessories input/output cannot be used as simple accessories. Remove Them from required accessories');
        var Combined_Datas = {};
        var CombId = 0;
        Object.keys(Combined_Array).forEach( Comb_Key => {
            Object.keys(Combined_Array[Comb_Key]).forEach( CombAcc_Key => {
                const CombInId = Combined_Array[Comb_Key][CombAcc_Key].In;
                const CombOutId = Combined_Array[Comb_Key][CombAcc_Key].Out;
                CombId++;
                const Detector_Data = Object.values(Array.from(UsuableIn))
                                        .filter(detector => (detector.Id == CombInId)).shift();
                const Output_Data = Object.values(Array.from(UsuableOut))
                                        .filter(output => (output.Id == CombOutId)).shift();
                var Combined_Data = {
                            Id: CombId,
                            Required: true,
                            accessorytype: `Combined_${Comb_Key}`,
                            name: Detector_Data.Label,
                            InObj: Detector_Data,
                            OutObj: Output_Data,
                            longName: `comb_${CombId}_${((Detector_Data.Label).toLowerCase()).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '_')}`,
                };
                this.DiscoveredAccessories.Detectors[Detector_Data.Id].accessorytype = `${Comb_Key}`;
                this.DiscoveredAccessories.Detectors[Detector_Data.Id].Required = false;
                this.DiscoveredAccessories.Outputs[Output_Data.Id].Required = false;
                Combined_Datas[CombId] = Combined_Data;
            });
        });
        return Combined_Datas;
    }

    PreConfigureAccessories(DeviceFamily) {
        switch (DeviceFamily) {
            case 'Partitions':
                this.log.info('PreConf Accessory => Add Partitions');
                // if (this.Partitions == 'system') {
                if (this.SystemMode) {
                    let SystemName = this.RiscoPanel.MBSystem.Label;
                    this.log.info(`PreConf Accessory => Configuration for System: ${SystemName}`);
                    let ContextObj = {
                        Id: 0,
                        Required: true,
                        accessorytype: 'System',
                        name: SystemName,
                        // ObjInst: Object.values(this.DiscoveredAccessories.Partitions),
                        ObjInst: Object.values(this.DiscoveredAccessories.Partitions).filter( partition => partition.Required === true),
                        MBObj: ( () => {
                            if (this.AddPanel2FirstPart) {
                                return this.RiscoPanel.MBSystem;
                            } else {
                                return undefined;
                            }
                        })(),
                        longName: `system_0_${(SystemName.toLowerCase()).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '_')}`,
                    };
                    Object.values(ContextObj.ObjInst).forEach( (partition) => {
                        delete partition.MBObj;
                    });
                    var SystemConfig = {
                        context: ContextObj,
                        RiscoSession: this.RiscoPanel,
                        Label: this.RiscoPanel.MBSystem.Label,
                        OccupancyPreventArming: (this.Config['OccupancyPreventArming'] != undefined) ? this.Config['OccupancyPreventArming'] : true,
                    };
                    this.Devices.push(SystemConfig);
                } else {
                    Object.values(this.DiscoveredAccessories.Partitions).forEach( PartsObject => {
                        if (PartsObject.Required == true) {
                            this.log.info(`PreConf Accessory => Configuration for Partitions Id : ${PartsObject.Id} and labeled "${PartsObject.name}"`);
                            var PartConfig = {
                                context: PartsObject,
                                RiscoSession: this.RiscoPanel,
                                OccupancyPreventArming: (this.Config['OccupancyPreventArming'] != undefined) ? this.Config['OccupancyPreventArming'] : true,
                            };
                            this.Devices.push(PartConfig);
                        }
                    });
                }
                break;
            case 'Outputs':
                this.log.info('Add Accessory => Add Outputs');
                for (var OutputId in this.DiscoveredAccessories.Outputs) {
                    if (this.DiscoveredAccessories.Outputs[OutputId].Required == true) {
                        this.log.info(`PreConf Accessory => Configuration for Outputs Id : ${this.DiscoveredAccessories.Outputs[OutputId].Id} and labeled "${this.DiscoveredAccessories.Outputs[OutputId].name}"`);
                        var OutputConfig = {
                            context: this.DiscoveredAccessories.Outputs[OutputId],
                            RiscoSession: this.RiscoPanel,
                        };
                        this.Devices.push(OutputConfig);
                    }
                }
                break;
            case 'Detectors':
                this.log.info('Add Accessory => Add Detectors');
                for (var DetectorId in this.DiscoveredAccessories.Detectors) {
                    if (this.DiscoveredAccessories.Detectors[DetectorId].Required == true) {
                        this.log.info(`PreConf Accessory => Configuration for Detectors Id : ${this.DiscoveredAccessories.Detectors[DetectorId].Id} and labeled "${this.DiscoveredAccessories.Detectors[DetectorId].name}"`);
                        var DetectorConfig = {
                            context: this.DiscoveredAccessories.Detectors[DetectorId],
                            RiscoSession: this.RiscoPanel,
                        };
                        this.Devices.push(DetectorConfig);
                    }
                }
                break;
            case 'Combineds':
                this.log.info('Add Accessory => Add Combined');
                for (var CombinedId in this.DiscoveredAccessories.Combineds) {
                    if (this.DiscoveredAccessories.Combineds[CombinedId].Required == true) {
                        this.log.info(`PreConf Accessory => Configuration for Combined Id : ${this.DiscoveredAccessories.Combineds[CombinedId].Id} and labeled "${this.DiscoveredAccessories.Combineds[CombinedId].name}"`);
                        var CombinedConfig = {
                            context: this.DiscoveredAccessories.Combineds[CombinedId],
                            RiscoSession: this.RiscoPanel,
                        };
                        this.Devices.push(CombinedConfig);
                    }
                }
                break;
        };
    }
}

module.exports = (api) => {
    hap = api.hap;
    Service = api.hap.Service;
    Characteristic = api.hap.Characteristic;
    UUIDGen = api.hap.uuid;
    api.registerPlatform(pluginName, platformName, RiscoLanPlatform);
};

