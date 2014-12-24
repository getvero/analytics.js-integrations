'use strict';

var Analytics = require('analytics.js').constructor;
var integration = require('analytics.js-integration');
var json = require('json');
var tester = require('analytics.js-integration-tester');
var sandbox = require('clear-env');
var plugin = require('./');

describe('Extole', function(){
  var Extole = plugin;
  var extole;
  var analytics;
  var options = {
    clientId: 99286621,
    events: {}
  };

  beforeEach(function(){
    analytics = new Analytics;
    extole = new Extole(options);
    analytics.use(plugin);
    analytics.use(tester);
    analytics.add(extole);
  });

  afterEach(function(done){
    function teardown() {
      analytics.restore();
      analytics.reset();
      extole.reset();
      sandbox();
      done();
    }

    if (extole.loaded() && window.extole.main) {
      return waitForWidgets(function(){
        xtlTearDown();
        teardown();
      });
    }

    teardown();
  });

  it('should have the correct settings', function(){
    analytics.compare(Extole, integration('Extole')
      .global('extole')
      .option('clientId', '')
      .mapping('events'));
  });

  describe('before loading', function(){
    beforeEach(function(){
      analytics.stub(extole, 'load');
    });

    describe('#initialize', function(){
      it('should call #load', function(){
        analytics.initialize();
        analytics.called(extole.load);
      });
    });
  });

  describe('loading', function(){
    it('should load', function(done){
      analytics.load(extole, done);
    });

    it('should create window.extole object when loaded', function(done){
        analytics.assert(!window.extole);
        analytics.load(extole, function(){
          analytics.assert(window.extole);
          done();
        });
    });
  });

  describe('after loading', function(){
    beforeEach(function(done){
      analytics.once('ready', function(){
        window.extole.microsite ? done() : window.extole.initializeGo().andWhenItsReady(done);
      });

      analytics.initialize();
    });

    describe('#track', function(){
      beforeEach(function(){
        extole.options.events = {
          'loan made': {
            e: 'email',
            'tag:cart_value': 'loan',
            partner_conversion_id: 'userId',
          },
          'investment made': {
            e: 'email',
            'tag:cart_value': 'investment',
            partner_conversion_id: 'userId'
          }
        };

        // Can only get user email if user is identified already
        analytics.identify(Math.floor(Math.random() * 999999), {
          name: 'first last',
          email: 'name@example.com'
        });

        analytics.spy(window.extole.main, 'fireConversion');
      });

      it('should not track a Completed Order if there is an Events mapping', function(){
        var randomOrderId = Math.floor(Math.random() * 999999);

        analytics.track('completed order', {
          orderId: randomOrderId,
          revenue: 1.95,
          products: [{
            sku: 'fakesku',
            quantity: 1,
            price: 1.95,
            name: 'fake-product',
          }]
        });

        analytics.equal(document.querySelector('script[type="extole/conversion"]'), null);
        analytics.didNotCall(window.extole.main.fireConversion);
      });

      it('should track an Event in the Events mapping', function(done){
        var randomOrderId = Math.floor(Math.random() * 999999);
        var user = analytics.user();

        window.extole.events.on('conversion:purchase', function(){ done(); });

        analytics.track('loan made', {
          email: user.traits().email,
          userId: user.id(),
          loan: 1.23,
        });

        var el = document.querySelector('script[type="extole/conversion"]');
        var expected = {
          type: 'purchase',
          params: {
            e: 'name@example.com',
            'tag:cart_value': '1.23',
            partner_conversion_id: '' + user.id
          }
        };
        analytics.assert(el.textContent, json.stringify(expected));
        analytics.called(window.extole.main.fireConversion);
      });

      it('should track a different Event in Events', function(done){
        var randomOrderId = Math.floor(Math.random() * 999999);
        var user = analytics.user();

        window.extole.events.on('conversion:purchase', function(){ done(); });

        analytics.track('investment made', {
          email: user.traits().email,
          userId: user.id(),
          investment: 1.23,
        });

        var el = document.querySelector('script[type="extole/conversion"]');
        var expected = {
          type: 'purchase',
          params: {
            e: 'name@example.com',
            'tag:cart_value': '1.23',
            partner_conversion_id: '' + user.id
          }
        };

        analytics.assert(el.textContent, json.stringify(expected));
        analytics.called(window.extole.main.fireConversion);
      });

      it('should not track an Event that is not in the Events mapping', function(){
        var randomOrderId = Math.floor(Math.random() * 999999);
        var user = analytics.user();

        analytics.track('crazy thing done', {
          email: user.traits().email,
          userId: user.id(),
          craziness: 9.99,
        });

        var el = document.querySelector('script[type="extole/conversion"]');
        analytics.equal(el, null);
        analytics.didNotCall(window.extole.main.fireConversion);
      });
    });

    describe('#completedOrder', function(){
      beforeEach(function(){
        analytics.identify('123',{
          name: 'first last',
          email: 'name@example.com'
        });
        analytics.spy(window.extole.main, 'fireConversion');
      });

      it('should send ecommerce data', function(done){
        var randomOrderId = Math.floor(Math.random() * 999999);

        window.extole.events.on('conversion:purchase', function(){ done(); });

        analytics.track('completed order', {
          orderId: randomOrderId,
          revenue: 1.95,
          products: [{
            sku: 'fakesku',
            quantity: 1,
            price: 1.95,
            name: 'fake-product',
          }]
        });

        var el = document.querySelector('script[type="extole/conversion"]');
        var expected = {
          type: 'purchase',
          params: {
            e: 'name@example.com',
            'tag:cart_value': '1.95',
            partner_conversion_id: '' + randomOrderId
          }
        };

        analytics.assert(el.textContent, json.stringify(expected));
        analytics.called(window.extole.main.fireConversion);
      });
    });
  });
});

/**
 * Extole setup/teardown helper functions.
 */

function waitForWidgets(cb, attempts){
  window.extole.require(['jquery'], function(_$){
    var attempts = attempts || 70;
    if ((attempts < 2) || (_$('[id^="extole-advocate-widget"]')[0] &&
    _$('[id^="easyXDM_cloudsponge"]')[0] &&
    _$('#cs_container')[0] &&
    _$('#cs_link')[0])) {
      window.setTimeout(cb, 200);
    } else {
      window.setTimeout(function(){
        waitForWidgets(cb, attempts-1);
      }, 100);
    }
  });
};

function messageListenerOff(){
  window.extole.require(['jquery'], function(_$){
    window.extole.$ = _$;
    var windowEvents = window.extole.$._data(window.extole.$(window)[0], 'events');
    var msgEventArr = windowEvents.message;
    var msgNamespace;
    if (msgEventArr) {
      for (var i = 0; i < msgEventArr.length; i++) {
        var msgEvent = msgEventArr[i];
        if (msgEvent.namespace && msgEvent.namespace.match) {
          if (msgNamespace = msgEvent.namespace.match(/^view\d+$/)){
            extole.$(window).off('message.' + msgNamespace);
          }
        }
      }
    }
  });
};

function xtlTearDown(){
  window.extole.require(['jquery'], function(_$){
    window.extole.$ = _$;
    var xtlSelectors = '[id^="extole-"], [id^="easyXDM_cloudsponge"], div[class^="extole"], #cs_container, #cs_link, #wrapped, #footer, style, link[href="https://api.cloudsponge.com/javascripts/address_books/floatbox.css"], link[href^="https://media.extole.com/"]';
    var xtlQ = window.extole.$(xtlSelectors);
    xtlQ.remove();
    delete window.cloudsponge;
    messageListenerOff();
  });
};
