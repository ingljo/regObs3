/**
 * Created by ingljo 14.12.2016
 */
angular
    .module('RegObs')
    .component('mapAreaSelect',
    {
        template: '<div class="map-area-select" data-tap-disabled="true"></div>',
        controller: function ($element, Map, $scope, AppSettings, AppLogging, $timeout, RegObsClasses, $rootScope) {
            var ctrl = this;

            var changeTimer;

            var div = $element.find('div')[0];
            var map = L.map(div, {
                zoomControl: false,
                attributionControl: false,
                maxZoom: AppSettings.maxMapZoomLevel
            });

            var tile = AppSettings.tiles[0];
            var layer = new RegObsClasses.RegObsTileLayer(tile.url,
            {
                reuseTiles: false,
                folder: AppSettings.mapFolder,
                name: tile.name,
                embeddedUrl: tile.embeddedUrl,
                embeddedMaxZoom: tile.embeddedMaxZoom,
                debugFunc: AppSettings.debugTiles ? AppLogging.debug : null
            });
            map.addLayer(layer);

            if (ctrl.bounds) {
                map.fitBounds(ctrl.bounds);
            } else {
                map.fitBounds(Map.getLastViewBounds());
            }

            if (ctrl.disableUserInteraction) {
                map._handlers.forEach(function (handler) {
                    handler.disable();
                });
            }

            var change = function () {
                $timeout(function () {
                    ctrl.bounds = map.getBounds();
                    ctrl.zoom = map.getZoom();
                    if (ctrl.onChange) {
                        ctrl.onChange();
                    }
                }, 0);
            };

            map.on('moveend', change);
            map.on('zoomend', change);

            change();

            $scope.$on('$destroy', function () {
                if (changeTimer) {
                    $timeout.cancel(changeTimer);
                }
                map.remove();
            });

            $rootScope.$on('$ionicView.enter', function () {
                map.invalidateSize();
            });
        },
        bindings: {
            bounds: '=?',
            zoom: '=?',
            onChange: '&',
            disableUserInteraction: '<'
        }
    });
