﻿angular
    .module('RegObs')
    .factory('Map', function (AppSettings, AppLogging, ObsLocation, Observations, Utility, $state, Registration, $ionicPlatform, $rootScope, $q, $timeout, $ionicPopup, $interval, RegobsPopup, PresistentStorage, $translate, RegObsClasses) {
        var service = this;

        var map, //Leaflet map
            layerGroups, //Layer groups object
            obsLocationMarker, //Leaflet marker for current obs location
            userMarker, //Leaflet marker for user position
            pathLine, //Leaflet (dotted) path between user position and current obs location
            observationInfo, //Obs location information. Displayed on top right corner
            tiles = [], //Map tiles
            isProgramaticZoom = false, //Is currently programatic zoom
            followMode = true, //Follow user position, or has user manually dragged or zoomed map?
            center = [62.5, 10]; //default map center when no observation or user location


        /**
         * Map selected item, this could be observations, nearby places or location marker
         */
        service._selectedItem = null;

        /**
         * Set selected item
         * @param {} header 
         * @param {} description 
         * @returns {} 
         */
        service._setSelectedItem = function (item) {
            service._selectedItem = item;
            if (item) {
                if (item.setViewOnSelect) {
                    var pos = item.getPosition();
                    if (pos) {
                        service._disableFollowMode();
                        map.panTo(pos); //pan map to selected item
                    }
                }
                service._updateSelectedItemDistance();
            }

            $rootScope.$broadcast('$regObs:mapItemSelected', item);
        };

        /**
         * Update selected item with distance to user position
         * @returns {} 
         */
        service._updateSelectedItemDistance = function () {
            if (service._selectedItem && userMarker) {
                var latlng = service._selectedItem.getLatLng();
                var distance = service.getUserDistanceFrom(latlng);

                $timeout(function () { //using timout to apply changes to ui
                    service._selectedItem.setDistance(distance);
                });
            }
        };

        /**
         * Update info text with distance from user to observation
         * @param {} latlng 
         * @returns {} 
         */
        service._updateObsInfoText = function (latlng) {
            var text = '';
            if (latlng && userMarker) {
                var distance = userMarker.getLatLng().distanceTo(latlng).toFixed(0);
                text = Utility.getDistanceText(distance);
            } else if (userMarker && !latlng) {
                text = '0m';
            } else if (!ObsLocation.isSet()) {
                text = $translate.instant('NOT_SET');
            }

            observationInfo.setText(text);
        };

        /**
         * On obs location changed
         * @param {} latlng 
         * @returns {} 
         */
        service._onObsLocationChange = function (latlng) {
            service._updateObsInfoText(latlng);
            service._updateDistanceLineLatLng(latlng);
            service._updateSelectedItemDistance();
        };

        /**
         * Unselect all markers
         * @returns {} 
         */
        service._unselectAllMarkers = function () {
            layerGroups.observations.getLayers()
                .forEach(function (item) {
                    if (item.setUnselected) {
                        item.setUnselected();
                    }
                });
            layerGroups.locations.getLayers()
                .forEach(function (item) {
                    if (item.setUnselected) {
                        item.setUnselected();
                    }
                });

            if (obsLocationMarker) {
                obsLocationMarker.setUnselected();
            }
        };

        /**
         * Draw observations stored in presistant storage
         * @returns {} 
         */
        service._drawObservations = function () {
            layerGroups.observations.clearLayers();
            Observations.getStoredObservations(Utility.getCurrentGeoHazardTid()).then(function (result) {
                result.forEach(function (obsJson) {
                    var m = new RegObsClasses.ObservationMarker(obsJson);
                    m.on('selected', service._setSelectedItem);
                    m.addTo(layerGroups.observations);
                });
            });
        };

        /**
         * Remove all observations in map
         * @returns {} 
         */
        service._removeObservations = function () {
            layerGroups.observations.clearLayers();
        };

        /**
         * Draw locations stored in presistant storage as stored location markers
         * @returns {} 
         */
        service._drawStoredLocations = function () {
            service._clearAllStoredLocations();
            Observations.getLocations(Utility.getCurrentGeoHazardTid()).forEach(function (loc) {
                var m = new RegObsClasses.StoredLocationMarker(loc);
                m.on('selected', service._setSelectedItem);
                m.addTo(layerGroups.locations);
            });
        };

        /**
         * Hide all stored locations
         * @returns {} 
         */
        service._clearAllStoredLocations = function () {
            layerGroups.locations.clearLayers();
        };



        /**
         * Set obs location
         * @param {} latlng 
         * @returns {} 
         */
        service._setObsLocation = function (latlng) {
            if (latlng) {
                obsLocationMarker.setObsLocationManually(latlng);
                obsLocationMarker.setSelected();
            }
        };

        /**
         * Update distance path line
         * @param {} latlng 
         * @returns {} 
         */
        service._updateDistanceLineLatLng = function (latlng) {
            if (userMarker && latlng) { //TODO: remove path when obslocation is not set?
                var path = [latlng, userMarker.getLatLng()];
                if (!pathLine) {
                    pathLine = L.polyline(path, { color: 'black', weight: 6, opacity: .5, dashArray: "10,10" })
                        .addTo(layerGroups.user);
                } else {
                    pathLine.setLatLngs(path);
                }
            }
        };

        /**
         * Refresh user position in map
         * @param {} position 
         * @returns {} 
         */
        service._refreshUserMarker = function (position) {
            if (position) {
                var latlng = new L.LatLng(position.latitude, position.longitude);

                if (!userMarker) {
                    userMarker = L.userMarker(latlng,
                        { pulsing: true, accuracy: position.accuracy, smallIcon: true, zIndexOffset: 1000 });
                    userMarker.addTo(layerGroups.user);
                } else {
                    userMarker.setLatLng(latlng);
                    userMarker.setAccuracy(position.accuracy);
                }

                if (followMode) {
                    map.panTo(latlng);
                }
            }
        };

        var hideAllTiles = function () {
            for (var i = 1; i < tiles.length; i++) {
                layerGroups.tiles.removeLayer(tiles[i]);
            }
        };

        var getTileIndex = function (name) {
            for (var i = 0; i < AppSettings.tiles.length; i++) {
                if (AppSettings.tiles[i].name === name) {
                    return i;
                }
            }
            return -1;
        };

        var getTileByName = function (name) {
            var index = getTileIndex(name);
            return tiles[index];
        };

        service.getTileByName = getTileByName;

        var showTile = function (name, opacity) {
            if (layerGroups.tiles) {
                var t = getTileByName(name);
                if (t) {
                    if (opacity) {
                        t.setOpacity(opacity);
                    }
                    layerGroups.tiles.addLayer(t);
                }
            }
        };

        service._disableFollowMode = function () {
            followMode = false;
        };

        /**
         * GPS position updated
         * @param {} position 
         * @returns {} 
         */
        service._onPositionUpdate = function (position) {
            service._refreshUserMarker(position);
            var latlng = new L.LatLng(position.latitude, position.longitude);
            obsLocationMarker.setUserPosition(latlng);
            service._updateSelectedItemDistance();
        };

        service._onObsLocationCleared = function () {
            service.clearSelectedMarkers();
            if (pathLine) {
                layerGroups.user.removeLayer(pathLine);
                pathLine = null;
            }
        };



        /**
         * Main method for creating map
         * @param {} elem 
         * @returns {} 
         */
        service.createMap = function (elem) {
            if (ObsLocation.isSet()) {
                var currentPosition = ObsLocation.get();
                center = [currentPosition.Latitude, currentPosition.Longitude];
            }

            map = L.map(elem, {
                center: center,
                zoom: 5,
                maxZoom: AppSettings.maxMapZoomLevel,
                zoomControl: false,
                attributionControl: false
            });

            layerGroups = { //Layers are added in order
                tiles: L.layerGroup().addTo(map),
                locations: L.markerClusterGroup({
                    showCoverageOnHover: false,
                    iconCreateFunction: function (cluster) {
                        var innerDiv = '<div class="nearby-location-marker-inner nearby-location-marker-inner-cluster">' + cluster.getChildCount() + '</div>';
                        return L.divIcon({ html: innerDiv, className: 'nearby-location-marker obs-marker-cluster snow', iconSize: L.point(30, 30) });
                    }
                }).addTo(map),
                observations: L.markerClusterGroup({
                    showCoverageOnHover: false,
                    iconCreateFunction: function (cluster) {
                        var innerDiv = '<div class="observation-pin obs-marker-cluster snow"><div class="observation-pin-icon">' + cluster.getChildCount() + '</div></div>';
                        return L.divIcon({ html: innerDiv, className: 'observation-pin-cluster', iconSize: L.point(30, 30) });
                    }
                }).addTo(map),
                user: L.layerGroup().addTo(map)
            };

            tiles = [];

            AppSettings.tiles.forEach(function (tile) {
                var t = L.tileLayerRegObs(tile.url, { folder: AppSettings.mapFolder, name: tile.name, debugFunc: AppLogging.log });
                tiles.push(t);
            });
            tiles[0].addTo(layerGroups.tiles);

            observationInfo = L.obsLocationInfo().addTo(map);

            map.on('locationfound', service._onPositionUpdate);

            map.on('locationerror',
                function (e) {
                    AppLogging.log('GPS error: ' + e.message);
                });

            map.on('contextmenu', function (e) {
                service._setObsLocation(e.latlng);
            });

            map.on('click', function (e) {
                //TODO: hide menus
                AppLogging.log('Click in map - hide floating menu');
                service.clearSelectedMarkers();
            });

            map.on('dragstart', service._disableFollowMode);
            map.on('zoomstart', function () {
                if (!isProgramaticZoom) {
                    service._disableFollowMode();
                }
            });

            obsLocationMarker = new RegObsClasses.CurrentObsLocationMarker(center);
            obsLocationMarker.on('selected', service._setSelectedItem);
            obsLocationMarker.on('obsLocationChange', service._onObsLocationChange);
            obsLocationMarker.on('obsLocationCleared', service._onObsLocationCleared);
            obsLocationMarker.addTo(layerGroups.user);

            service.updateMapFromSettings();

            if (ObsLocation.isSet()) {
                service.setView(L.latLng(ObsLocation.get().Latitude, ObsLocation.get().Longitude));
            }

            return map;
        };

        /**
        * Remove current set obs location
        * @returns {} 
        */
        service.clearObsLocation = function () {
            obsLocationMarker.clear();
        };

        service.clearSelectedMarkers = function () {
            service._unselectAllMarkers();
            service._setSelectedItem(null);
        };

        service.setView = function (latlng, zoom) {
            isProgramaticZoom = true;
            map.setView(latlng, zoom || 9);
            isProgramaticZoom = false;
        };

        service.getCenter = function () {
            return map.getCenter();
        };

        service.getZoom = function () {
            return map.getZoom();
        };

        service.getTiles = function () {
            return tiles;
        };

        service.getUserDistanceFrom = function (latlng) {
            if (userMarker) {
                var distance = userMarker.getLatLng().distanceTo(latlng).toFixed(0);
                var description = Utility.getDistanceText(distance);
                return { distance: distance, description: description };
            }
            return { distance: null, description: 'Ikke kjent' };
        };

        service.centerMapToUser = function () {
            followMode = true;
            if (userMarker) {
                AppLogging.log('Center map to user marker');
                if (map) {
                    map.panTo(userMarker.getLatLng());
                }
            }
        };

        service.changeAppMode = function () {
            service.updateMapFromSettings();
        };

        service.updateObservationsInMap = function () {
            if (map) {
                var center = map.getCenter();
                var bounds = map.getBounds();
                var radius = parseInt((bounds.getNorthWest().distanceTo(bounds.getSouthEast()) / 2).toFixed(0));
                var geoHazardTid = Utility.getCurrentGeoHazardTid();

                var workFunc = function (onProgress, cancel) {
                    return Observations
                        .updateObservationsWithinRadius(center.lat,
                            center.lng,
                            radius,
                            geoHazardTid,
                            new RegObs.ProggressStatus(),
                            onProgress,
                            cancel);
                };

                RegobsPopup.downloadProgress('Oppdaterer kartet med det siste fra regObs',
                    workFunc,
                    { longTimoutMessageDelay: 10, closeOnComplete: true })
                .then(function () {
                    AppLogging.log('progress completed');
                })
                .catch(function () {
                    AppLogging.log('progress cancelled');
                })
                .finally(service.updateMapFromSettings);
            }
        };

        //TODO: Move/Rename this to map.refresh() or something
        service.updateMapFromSettings = function () {
            hideAllTiles();
            var geoId = Utility.getCurrentGeoHazardTid();
            AppSettings.data.maps.forEach(function (mapSetting) {
                if (mapSetting.geoHazardTid === geoId) {
                    if (mapSetting.tiles) {
                        mapSetting.tiles.forEach(function (tileSetting) {
                            if (tileSetting.visible) {
                                showTile(tileSetting.name, tileSetting.opacity);
                            }
                        });
                    }
                }
            });
            if (AppSettings.data.showPreviouslyUsedPlaces) {
                service._drawStoredLocations();
            } else {
                service._clearAllStoredLocationsations();
            }
            if (AppSettings.data.showObservations) {
                service._drawObservations();
            } else {
                service._removeObservations();
            }
            service.invalidateSize();
        };

        service.startWatch = function () {
            if (map) {
                AppLogging.log('Start watching gps location');
                document.addEventListener("deviceready",
                    function () {
                        map.locate({ watch: true, enableHighAccuracy: true });
                    },
                    false);
            }
        };

        service.clearWatch = function () {
            if (map) {
                AppLogging.log('Stop watching gps location');
                map.stopLocate();
            }
        };

        service.invalidateSize = function () {
            if (map) {
                map.invalidateSize();
            }
        };

        service.calculateXYZListFromBounds = function (bounds, zoomMin, zoomMax) {
            if (!tiles) return [];
            return tiles[0].calculateXYZListFromBounds(bounds, zoomMin, zoomMax);
        };

        service.calculateXYZSizeFromBounds = function (bounds, zoomMin, zoomMax) {
            if (!map || !tiles) return 0;
            return tiles[0].calculateXYZSizeFromBounds(bounds, zoomMin, zoomMax);
        };

        return service;
    });