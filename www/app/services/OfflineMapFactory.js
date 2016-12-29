﻿angular
    .module('RegObs')
    .factory('OfflineMap', function ($ionicPlatform, $window, $q, $cordovaFile, AppSettings, AppLogging, Map) {
        var service = this;
        var metaFilename = 'offline-meta.json';
        var meta;

        service.getOfflineAreas = function () {
            return $q(function (resolve, reject) {
                if (meta) { //map metadata is loaded, return
                    resolve(meta);
                } else { //load map metadata from file
                    $cordovaFile.readAsText(cordova.file.dataDirectory, metaFilename)
                        .then(function (success) {
                            // success
                            meta = JSON.parse(success);
                            resolve(meta);
                        }, function (error) {
                            if (error.code === 1) { //file does not exist
                                service.saveOfflineAreas([]).then(resolve([]));
                            } else {
                                reject(error);
                            }
                        });
                }
            });
        };

        service.saveOfflineAreas = function (metadata) {
            return $cordovaFile.writeFile(cordova.file.dataDirectory, metaFilename, JSON.stringify(metadata), true).then(function () {
                meta = metadata; //update saved metadata in memory
            });
        };

        service.deleteAllOfflineAreas = function () {
            return $q(function (resolve, reject) {
                $cordovaFile.removeRecursively(cordova.file.dataDirectory, AppSettings.mapFolder)
                    .then(function () {
                        service.saveOfflineAreas([]).then(resolve, reject);
                    },
                        function (error) {
                            AppLogging.log('Error deleting map folder: ' + JSON.stringify(error));
                            if (error.code === 1) { //directory does not exist
                                service.saveOfflineAreas([]).then(resolve);
                            } else {
                                reject(error);
                            }
                        });
            });
        };

        var existsInOtherOfflineMap = function (map, xyzCoordinate, areas) {
            var found = false;
            areas.forEach(function (area) {
                var mapExists = area.maps.filter(function (item) { return item === map }).length > 0;
                if (mapExists) {
                    var coordinateExists = area.xyzList.filter(function (item) {
                        return item.x === xyzCoordinate.x &&
                            item.y === xyzCoordinate.y &&
                            item.z === xyzCoordinate.z;
                    }).length > 0;
                    if (coordinateExists) {
                        found = true; //Another offline map has this coordinate for current map
                        return;
                    }
                }
            });
            return found;
        };

        service.deleteOfflineArea = function (area) {
            if (!area) throw Error('area parameter not set!');
            return $q(function (resolve, reject) {
                var otherAreas = meta.filter(function (item) { return item.name !== area.name });
                var deleted = 0;
                var skipped = 0;
                var error = 0;
                var checkDone = function () {
                    if ((deleted + skipped + error) === area.tiles) {
                        meta = otherAreas;
                        service.saveOfflineAreas(meta)
                            .finally(function () {
                                resolve({ deleted: deleted, skipped: skipped, error: error });
                            });
                    }
                }
                var callbackSuccess = function () {
                    deleted++;
                    checkDone();
                };
                var callbackError = function (e) {
                    AppLogging.log('cold not delete file. Error: ' + JSON.stringify(e));
                    error++;
                    checkDone();
                };
                var callbackSkip = function () {
                    skipped++;
                    checkDone();
                };

                area.xyzList.forEach(function (xyzCoordinate) {
                    AppLogging.log('Delete xyz coordinate: [' + xyzCoordinate.x + ',' + xyzCoordinate.y + ',' + xyzCoordinate.z + ']');
                    area.maps.forEach(function (map) {
                        if (existsInOtherOfflineMap(map, xyzCoordinate, otherAreas)) {
                            AppLogging.log('Map exists in other offline area, skipping');
                            callbackSkip();
                        } else {
                            var tile = Map.getTileByName(map);
                            if (!tile) {
                                AppLogging.log('tile ' + map + ' not found');
                                reject('tile ' + map + ' not found');
                            }
                            var filename = AppSettings.mapFolder + '/' + tile.getMapFilename(xyzCoordinate.x, xyzCoordinate.y, xyzCoordinate.z);
                            AppLogging.log('Deleting file:' + filename);
                            $cordovaFile.removeFile(cordova.file.dataDirectory, filename).then(callbackSuccess, callbackError);
                        }
                    });
                });
            });
        };

        var downloadAndStoreTile = function (tile, x, y, z, successCallback, errorCallback) {
            var sourceurl = tile._url_online.replace('{z}', z).replace('{x}', x).replace('{y}', y);
            var filename = cordova.file.dataDirectory + AppSettings.mapFolder + '/' + tile.getMapFilename(x, y, z);
            AppLogging.log("Download " + sourceurl + " => " + filename);

            if (tile.options.subdomains) {
                var idx = Math.floor(Math.random() * tile.options.subdomains.length);
                var dom = tile.options.subdomains[idx];
                sourceurl = sourceurl.replace('{s}', dom);
            }

            var transfer = new FileTransfer();
            transfer.download(
                sourceurl,
                filename,
                function (file) {
                    // tile downloaded OK; set the iOS "don't back up" flag then move on
                    file.setMetadata(null, null, { "com.apple.MobileBackup": 1 });
                    if (successCallback) successCallback();
                },
                function (error) {
                    var errmsg = '';
                    switch (error.code) {
                        case FileTransferError.FILE_NOT_FOUND_ERR:
                            errmsg = "Not found: " + sourceurl;
                            break;
                        case FileTransferError.INVALID_URL_ERR:
                            errmsg = "Invalid URL:" + sourceurl;
                            break;
                        case FileTransferError.CONNECTION_ERR:
                            errmsg = "Connection error at the web server.\n";
                            break;
                    }
                    if (errorCallback) errorCallback(errmsg);
                }
            );
        };

        var downloadXyzList = function (tile, xyzlist, overwrite, progressCallback, completeCallback, errorCallback, cancelCallback) {
            function runThisOneByIndex(xyzs, index, cbprog, cbdone, cberr, cbcancel) {
                var x = xyzs[index].x;
                var y = xyzs[index].y;
                var z = xyzs[index].z;

                // thanks to closures this function would call downloadAndStoreTile() for this XYZ, then do the callbacks and all...
                // all we need to do is call it below, depending on the overwrite outcome
                function doneWithIt() {
                    // the download was skipped and not an error, so call the progress callback; then either move on to the next one, or else call our success callback
                    if (cbprog) cbprog(index, xyzs.length);

                    if (index + 1 < xyzs.length) {
                        runThisOneByIndex(xyzs, index + 1, cbprog, cbdone, cberr, cbcancel);
                    } else {
                        if (cbdone) cbdone();
                    }
                }
                function yesReally() {
                    try {
                        downloadAndStoreTile(tile,
                            x,
                            y,
                            z,
                            doneWithIt,
                            function (errmsg) {
                                // an error in downloading, so we bail on the whole process and run the error callback
                                if (cberr) cberr(errmsg);
                                doneWithIt();
                            }
                        );
                    } catch (error) {
                        if (cberr) cberr(error.message);
                        doneWithIt();
                    }
                }

                var cancel = false;
                if (cbcancel) {
                    cancel = cbcancel();
                }

                if (cancel) {
                    if (cbdone) cbdone();
                } else {
                    // trick: if 'overwrite' is true we can just go ahead and download
                    // BUT... if overwrite is false, then test that the file doesn't exist first by failing to open it
                    if (overwrite) {
                        AppLogging.log("Tile " + z + '/' + x + '/' + y + " -- " + "Overwrite=true so proceeding.");
                        yesReally();
                    } else {
                        try {
                            var filename = tile.getMapFilename(x, y, z);
                            $cordovaFile.checkFile(cordova.file.dataDirectory, AppSettings.mapFolder + '/' + filename)
                              .then(function (success) {
                                  AppLogging.log(filename + " exists. Skipping.");
                                  doneWithIt();
                              }, function (error) {
                                  AppLogging.log(filename + " missing. Fetching.");
                                  yesReally();
                              });
                        } catch (error) {
                            if (cberr) cberr(error.message);
                            doneWithIt();
                        }

                    }
                }
            }
            runThisOneByIndex(xyzlist, 0, progressCallback, completeCallback, errorCallback, cancelCallback);
        };

        service.downloadMapFromXyzList = function (name, bounds, xyzList, zoomMin, zoomMax, mapsArray, progressCallback, completeCallback, cancelCallback) {
            var downloadMapFromXyzListInternal = function () {
                if (!zoomMin)
                    throw Error('zoomMin must be set');
                if (!zoomMax)
                    throw Error('zoomMax must be set');
                if (!mapsArray || mapsArray.length <= 0)
                    throw Error('Maps array must be an array of map names');
                if (!xyzList)
                    throw Error('Xyz list must be set!');

                var boundingBox = [
                    [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
                    [bounds.getNorthEast().lat, bounds.getNorthEast().lng]
                ];

                var area = { name: name, size: 0, bounds: boundingBox, tiles: xyzList.length * mapsArray.length, maps: mapsArray, xyzList: xyzList, zoom: zoomMax };
                meta.push(area);

                var mapStatus = [];

                AppLogging.log('Download map for xyz list: ' + JSON.stringify(xyzList));
                var checkProgress = function (tile) {
                    var hasAnyRunning = false;
                    var hasAnyError = false;
                    var total = xyzList.length * mapsArray.length;
                    var done = 0;
                    var errors = 0;
                    mapStatus.forEach(function (item) {
                        done += item.done;
                        if (done === total) {
                            item.complete = true;
                        }

                        if (!item.complete) {
                            hasAnyRunning = true;
                        }
                        if (item.error > 0) {
                            errors += item.error;
                            hasAnyError = true;
                        }
                    });
                    var percent = Math.round(100 * done / total);
                    if (hasAnyRunning || (mapStatus.length < mapsArray.length)) {
                        if (progressCallback) {
                            progressCallback({
                                complete: false,
                                total: total,
                                done: done,
                                percent: percent,
                                status: mapStatus,
                                hasError: hasAnyError
                            });
                        }
                    } else {
                        service.getDiskUsageForXyzList(mapsArray, xyzList, function (files, bytes) {
                            area.size = bytes;
                            area.hasError = hasAnyError;
                            area.tiles = done - errors;
                            if (files !== area.tiles) {
                                AppLogging.warn('Tiles downloaded ' + area.tiles + ' but files from disk usage is ' + files);
                            }

                            service.saveOfflineAreas(meta)
                                .finally(function () {
                                    if (completeCallback) {
                                        completeCallback({
                                            complete: true,
                                            total: total,
                                            done: done,
                                            percent: percent,
                                            status: mapStatus,
                                            hasError: hasAnyError
                                        });
                                    }
                                });
                        });
                    }
                };
                mapsArray.forEach(function (item) {
                    var tile = Map.getTileByName(item);
                    var description = AppSettings.getTileByName(item).description;
                    var status = {
                        name: item,
                        description: description,
                        total: xyzList.length,
                        done: 0,
                        percent: 0,
                        complete: false,
                        error: 0
                    };
                    mapStatus.push(status);
                    downloadXyzList(tile, xyzList,
                        false,
                        function (done, total) {
                            status.done = done;
                            status.total = total;
                            status.percent = Math.round(100 * done / total);
                            checkProgress(tile);
                        },
                        function () {
                            status.complete = true;
                            status.done = status.total;
                            status.percent = 100;
                            checkProgress(tile);
                        },
                        function (error) {
                            status.error++;
                            checkProgress(tile);
                        },
                        cancelCallback);
                });
            };

            service.getOfflineAreas().then(downloadMapFromXyzListInternal);
        };

        service.downloadMapFromBounds = function (name, bounds, zoomMin, zoomMax, mapsArray, progressCallback, completeCallback, cancelCallback) {
            var xyzList = Map.calculateXYZListFromBounds(bounds, zoomMin, zoomMax);
            service.downloadMapFromXyzList(name, bounds, xyzList,
                zoomMin,
                zoomMax,
                mapsArray,
                progressCallback,
                completeCallback,
                cancelCallback);
        };

        service.getFileName = function (map, x, y, z) {
            return [map, z, x, y].join('-') + '.png';
        };

        service.getFilesFromXyzList = function (maps, xyzList) {
            var files = [];
            xyzList.forEach(function (coord) {
                maps.forEach(function (map) {
                    files.push(service.getFileName(map, coord.x, coord.y, coord.z));
                });
            });
            return files;
        };

        service.getDiskUsageForXyzList = function (maps, xyzList, callback) {
            var fileNames = service.getFilesFromXyzList(maps, xyzList);
            AppLogging.log('Filenames to find: ' + JSON.stringify(fileNames));
            var found = [];
            var notFound = [];
            var bytes = 0;

            var checkCallback = function() {
                if ((found.length + notFound.length) === fileNames.length) {
                    if(callback){
                        callback(found.length, bytes);
                    }
                    return;
                }
            };

            fileNames.forEach(function (file) {
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory + AppSettings.mapFolder + '/' + file,
                    function (fileEntry) {
                        fileEntry.file(function (fileInfo) {
                            bytes += fileInfo.size;
                            found.push(file);
                            checkCallback();
                        }, function(error) {
                            notFound.push({ name: file, error: error });
                            checkCallback();
                        });
                    }, function(error) {
                        notFound.push({ name: file, error: error });
                        checkCallback();
                    });
            });
        };

        return service;
    });