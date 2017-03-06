#!/usr/bin/env node

var fs = require('fs');     // nodejs.org/api/fs.html
var plist = require('plist');  // www.npmjs.com/package/plist

var FILEPATH = 'platforms/ios/regObs/regObs-Info.plist';

module.exports = function (context) {

	if (context.opts.platforms.indexOf('ios') < 0) {
		return;
	}

    var xml = fs.readFileSync(FILEPATH, 'utf8');
    var obj = plist.parse(xml);

    obj.ITSAppUsesNonExemptEncryption = false;

    console.log('Got plist CFBundleShortVersionString: ' +obj.CFBundleShortVersionString);
    var trimmedVersion = obj.CFBundleShortVersionString.replace(/\./g, '');
    console.log('Setting new CFBundleShortVersionString: ' +trimmedVersion);

    obj.CFBundleShortVersionString = trimmedVersion;

    obj.NSMainNibFile = null;
    obj['NSMainNibFile~ipad'] = null; //fix for some bug in plist node module that wrongly converts this <key> to <string>

    xml = plist.build(obj);
    //fs.writeFileSync(FILEPATH, xml, { encoding: 'utf8' }); //there is some bug in saving plist, so it won't open in XCode
};