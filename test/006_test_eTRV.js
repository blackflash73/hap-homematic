const assert = require('assert')
const path = require('path')
const Logger = require(path.join(__dirname, '..', 'lib', 'logger.js'))
const Server = require(path.join(__dirname, '..', 'lib', 'Server.js'))
const Service = require('hap-nodejs').Service
const Characteristic = require('hap-nodejs').Characteristic
const expect = require('expect.js')

const fs = require('fs')
let log = new Logger('HAP Test')
log.setDebugEnabled(false)

const testCase = 'HmIP-eTRV-2.json'

describe('HAP-Homematic Tests ' + testCase, () => {
  let that = this

  before(async () => {
    log.debug('preparing tests')
    let datapath = path.join(__dirname, 'devices', testCase)
    let strData = fs.readFileSync(datapath).toString()
    if (strData) {
      that.data = JSON.parse(strData)

      that.server = new Server(log)

      await that.server.simulate(undefined, {config: {
        channels: Object.keys(that.data.ccu)
      },
      devices: that.data.devices})
    } else {
      assert.ok(false, 'Unable to load Test data')
    }
  })

  after(() => {
    Object.keys(that.server._publishedAccessories).map(key => {
      let accessory = that.server._publishedAccessories[key]
      accessory.shutdown()
    })
  })

  it('HAP-Homematic check test mode', (done) => {
    expect(that.server.isTestMode).to.be(true)
    done()
  })

  it('HAP-Homematic check number of ccu devices', (done) => {
    expect(that.server._ccu.getCCUDevices().length).to.be(1)
    done()
  })

  it('HAP-Homematic check number of mappend devices', (done) => {
    expect(Object.keys(that.server._publishedAccessories).length).to.be(1)
    done()
  })

  it('HAP-Homematic check assigned services', (done) => {
    Object.keys(that.server._publishedAccessories).map(key => {
      let accessory = that.server._publishedAccessories[key]
      expect(accessory.serviceClass).to.be(that.data.ccu[accessory.address()])
    })
    done()
  })

  var rnd = Math.floor(Math.random() * Math.floor(30))

  it('HAP-Homematic check ACTUAL_TEMPERATURE ' + rnd, (done) => {
    that.server._ccu.fireEvent('HmIP.2123456789ABCD:1.ACTUAL_TEMPERATURE', rnd)
    let accessory = that.server._publishedAccessories[Object.keys(that.server._publishedAccessories)[0]]
    let service = accessory.getService(Service.Thermostat)
    assert.ok(service, 'Thermostat Service not found')
    let ch = service.getCharacteristic(Characteristic.CurrentTemperature)
    assert.ok(ch, 'CurrentTemperature State Characteristics not found')
    ch.getValue((context, value) => {
      try {
        expect(value).to.be(rnd)
        done()
      } catch (e) {
        done(e)
      }
    })
  })

  let rnd1 = (Math.floor(Math.random() * Math.floor(24)) + 10) // make sure we do not set below the off themp and 10 is min value

  it('HAP-Homematic check SET_POINT_TEMPERATURE and HeatingMode ' + rnd1, (done) => {
    let accessory = that.server._publishedAccessories[Object.keys(that.server._publishedAccessories)[0]]
    let service = accessory.getService(Service.Thermostat)
    let ch = service.getCharacteristic(Characteristic.TargetTemperature)
    ch.setValue(rnd1, async () => {
      let value = await that.server._ccu.getValue('HmIP.2123456789ABCD:1.SET_POINT_TEMPERATURE')
      try {
        expect(value).to.be(rnd1)
      } catch (e) {

      }
    })
    // we have a temperature so the TargetHeatingCoolingState should be heating
    let ch1 = service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
    ch1.getValue((context, value) => {
      try {
        expect(value).to.be(Characteristic.CurrentHeatingCoolingState.HEAT)
        done()
      } catch (e) {
        done(e)
      }
    })
  })

  it('HAP-Homematic check Heating Mode Off', (done) => {
    that.server._ccu.fireEvent('HmIP.2123456789ABCD:1.SET_POINT_TEMPERATURE', 4.5)
    let accessory = that.server._publishedAccessories[Object.keys(that.server._publishedAccessories)[0]]
    let service = accessory.getService(Service.Thermostat)
    let ch = service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
    ch.getValue((context, value) => {
      try {
        expect(value).to.be(Characteristic.CurrentHeatingCoolingState.OFF)
        done()
      } catch (e) {
        done(e)
      }
    })
  })

  it('HAP-Homematic set Heating Mode Off check 4.5 degree', (done) => {
    let accessory = that.server._publishedAccessories[Object.keys(that.server._publishedAccessories)[0]]
    let service = accessory.getService(Service.Thermostat)
    let ch = service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
    ch.setValue(Characteristic.CurrentHeatingCoolingState.OFF, async () => {
      let value = await that.server._ccu.getValue('HmIP.2123456789ABCD:1.SET_POINT_TEMPERATURE')
      try {
        expect(value).to.be(4.5)
        done()
      } catch (e) {
        done(e)
      }
    })
  })

  it('HAP-Homematic set Heating Mode back to heating check ' + rnd1 + ' degree again', (done) => {
    let accessory = that.server._publishedAccessories[Object.keys(that.server._publishedAccessories)[0]]
    let service = accessory.getService(Service.Thermostat)
    let ch = service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
    ch.setValue(Characteristic.CurrentHeatingCoolingState.HEAT, () => {
      setTimeout(async () => {
        let value = await that.server._ccu.getValue('HmIP.2123456789ABCD:1.SET_POINT_TEMPERATURE')
        try {
          expect(value).to.be(rnd1)
          done()
        } catch (e) {
          done(e)
        }
      }, 100)
    })
  })
})