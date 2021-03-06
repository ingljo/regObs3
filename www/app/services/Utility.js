/**
 * Created by storskel on 06.10.2015.
 */
angular
    .module('RegObs')
    .factory('Utility', function Utility($http, $q, $rootScope, AppSettings, User, LocalStorage, AppLogging, $translate, $cordovaNetwork, moment, $filter, $ionicHistory, Raven, $state) {
        var service = this;

        var canvas;

        var geoHazardTid = {
            snow: 10,
            dirt: 20,
            water: 60,
            ice: 70
        };
        var DAYS_BEFORE_KDV_UPDATE = 7;

        var geoHazardColors = {};
        geoHazardColors[geoHazardTid.snow] = '#F2F2F2';
        geoHazardColors[geoHazardTid.dirt] = '#F4B183';
        geoHazardColors[geoHazardTid.ice] = '#C9C9C9';
        geoHazardColors[geoHazardTid.water] = '#9DC3E6';

        service.getExpositionArray = function () {
            return [
                { "val": null, "name": "Ikke gitt" },
                { "val": 0, "name": "N - fra nord", "shortName": "N" },
                { "val": 45, "name": "NØ - fra nordøst", "shortName": "NØ" },
                { "val": 90, "name": "Ø - fra øst", "shortName": "Ø" },
                { "val": 135, "name": "SØ - fra sørøst", "shortName": "SØ" },
                { "val": 180, "name": "S - fra sør", "shortName": "S" },
                { "val": 225, "name": "SV - fra sørvest", "shortName": "SV" },
                { "val": 270, "name": "V - fra vest", "shortName": "V" },
                { "val": 315, "name": "NV - fra nordvest", "shortName": "NV" }
            ];
        };

        service.getWindDirectionText = function (direction, useShortName) {
            var filteredResult = service.getExpositionArray().filter(function (item) {
                return item.val === direction;
            });
            if (filteredResult.length > 0) {
                return useShortName ? filteredResult[0].shortName : filteredResult[0].name;
            }
            return '';
        };

        service.getWindDirectionTextShort = function (direction) {
            return service.getWindDirectionText(direction, true);
        };

        service.getAvalCauseAttributes = function (item, data) {
            var arr = [];
            var pushIfNotEmpty = function (items) {
                items.forEach(function (item) {
                    if (item) {
                        arr.push(item.trim());
                    }
                });
            };
            pushIfNotEmpty([data.FullObject.AvalCauseAttributeCrystalTName,
            data.FullObject.AvalCauseAttributeLightTName,
            data.FullObject.AvalCauseAttributeSoftTName,
            data.FullObject.AvalCauseAttributeThinTName
            ]);

            return arr.join('&nbsp;&bull;&nbsp;');
        };

        service.getExposionHeightText = function (item, data) {
            var getValue = function (item) {
                if (item === undefined || item === null) {
                    return 'ukjent';
                }
                return item;
            };

            switch (data.FullObject.ExposedHeightComboTID) {
                case 1:
                    return 'Over ' + getValue(data.FullObject.ExposedHeight1) + ' moh';
                case 2:
                    return 'Under ' + getValue(data.FullObject.ExposedHeight1) + ' moh';
                case 3:
                    return 'Ikke mellom ' + getValue(data.FullObject.ExposedHeight1) + ' - ' + getValue(data.FullObject.ExposedHeight2) + ' moh';
                case 4:
                    return 'Mellom ' + getValue(data.FullObject.ExposedHeight1) + ' - ' + getValue(data.FullObject.ExposedHeight2) + ' moh';
            }

            return getValue(data.FullObject.ExposedHeight1) + ' moh';
        };

        /**
         * Get description from exposition bit order, for example 00011001
         * @param {} expositionBitOrder 
         * @returns {} 
         */
        service.getExpositonDescriptionFromBitOrder = function (expositionBitOrder) {
            if (expositionBitOrder === '11111111') {
                return $translate.instant('ALL');
            }

            var arr = service.getExpositionArray().filter(function (item) { return item.val !== null });
            var result = [];
            if (expositionBitOrder && expositionBitOrder.length > 0 && arr.length === expositionBitOrder.length) {
                for (var i = 0; i < expositionBitOrder.length; i++) {
                    var b = expositionBitOrder[i];
                    if (b === '1') {
                        var item = arr[i];
                        if (item && item.shortName) {
                            result.push(item.shortName);
                        }
                    }
                }
            }
            return result.join(', ');
        }

        service.formatUrls = function (arr) {
            var result = [];
            arr.forEach(function (url) {
                if (url.UrlLine && angular.isString(url.UrlLine)) {
                    var urlDesc = url.UrlDescription || url.UrlLine;
                    if (!url.UrlLine.toLowerCase().startsWith('http')) {
                        url.UrlLine = 'http://' + url.UrlLine;
                    }

                    result.push('<a target="_system" href="' + url.UrlLine + '">' + urlDesc + '</a>');
                }
            });
            return result.join(', ');
        };

        service.formatStabilityTest = function (fullObject) {
            var result = fullObject.PropagationTID > 0 ? fullObject.PropagationTName : '';

            if (fullObject.TapsFracture > 0) {
                result += fullObject.TapsFracture;
            }

            if (fullObject.FractureDepth) {
                result += '@';
                result += $filter('number')(fullObject.FractureDepth * 100, 0).replace(',', '.') + 'cm';
            }
            if (fullObject.ComprTestFractureTID > 0) {
                result += fullObject.ComprTestFractureTName;
            }
            return result;
        };

        service.showStabilityTest = function (fullObject) {
            return fullObject.PropagationTID > 0 || fullObject.TapsFracture > 0 || fullObject.FractureDepth > 0 || fullObject.ComprTestFractureTID > 0;
        };


        service._pushKdvDescription = function (tidValue, arr, prepos, kdvname, condition) {
            return $q(function (resolve) {
                if (tidValue && (condition === undefined || condition === true)) {
                    if (prepos) {
                        arr.push(prepos);
                    }
                    service.getKdvValue(kdvname, tidValue).then(function (result) {
                        if (result && result.Name) {
                            arr.push(result.Name.toLowerCase());
                        }
                        resolve();
                    });
                } else {
                    resolve();
                }
            });
        };

        service.formatWaterLevelMethod = function (fullObject) {
            return $q(function (resolve) {
                $translate(['MARKING', 'WATER_MEASUREMENT', 'ON_IN', 'WITH', 'RELATIVE_TO']).then(function (translations) {
                    var arr = [];
                    if (fullObject.WaterLevelMethodTID) {
                        arr.push(fullObject.WaterLevelMethodTID === 1 ? translations['MARKING'] : translations['WATER_MEASUREMENT']);
                        service._pushKdvDescription(fullObject.MarkingReferenceTID, arr, translations['ON_IN'], 'Water_MarkingReferenceKDV', fullObject.WaterLevelMethodTID === 1)
                            .then(function () {
                                return service._pushKdvDescription(fullObject.MarkingTypeTID, arr, translations['WITH'], 'Water_MarkingTypeKDV', fullObject.WaterLevelMethodTID === 1);
                            })
                            .then(function () {
                                if (fullObject.WaterLevelMethodTID === 2 && fullObject.MeasurementTypeTID === 1) {
                                    arr.push(translations['RELATIVE_TO']);
                                }
                                return service._pushKdvDescription(fullObject.MeasurementReferenceTID, arr, '', 'Water_MeasurementReferenceKDV', fullObject.WaterLevelMethodTID === 2);
                            })
                            .then(function () {
                                return service._pushKdvDescription(fullObject.MeasurementTypeTID, arr, translations['WITH'], 'Water_MeasurementTypeKDV', fullObject.WaterLevelMethodTID === 2 && fullObject.MeasurementTypeTID > 1);
                            })
                            .then(function () {
                                resolve(arr.join(' '));
                            });
                    } else {
                        resolve(arr.join(' '));
                    }
                });
            });
        };

        service.formatWaterLevelMeasurement = function (fullObject) {
            var result = [];
            if (fullObject && fullObject.WaterLevelMeasurement && angular.isArray(fullObject.WaterLevelMeasurement)) {
                fullObject.WaterLevelMeasurement.forEach(function (item) {
                    var str = '<div class="water-level-measurement">';
                    str += '<span class="observation-description">' + (fullObject.WaterLevelMethodTID === 1 ? $translate.instant('MARKING_SHORT') : $translate.instant('MEASUREMENT'));
                    str += ' ' + (result.length + 1) + '</span>: ';
                    if (item.DtMeasurementTime) {
                        str += service.formatDateAndTime(item.DtMeasurementTime);
                    }
                    if (item.WaterLevelValue) {
                        str += ', ' + $filter('number')(item.WaterLevelValue, 2) + ' m';
                    }
                    if (!service.isEmpty(item.Comment)) {
                        str += '<div class="water-level-comment-summary">' + item.Comment + '</div>';
                    }

                    if (item.Pictures && angular.isArray(item.Pictures) && item.Pictures.filter(function (pic) { return pic.PictureImageBase64 !== undefined }).length > 0) {
                        str += '<div class="registration-image-thumbs">';
                        item.Pictures.forEach(function (item) {
                            if (item.PictureImageBase64) {
                                str += '<img src="' + item.PictureImageBase64 + '" width="50" />';
                            }
                        });
                        str += '</div>';
                    }
                    str += ('</div>');

                    result.push(str);

                });
            }

            return result.join('');
        };


        //Brukt der det er bilder (RegistrationTID)
        var OBSERVATIONS = {
            Incident: {
                name: "Ulykke/Hendelse",
                RegistrationTID: "11",
                properties: {
                    IncidentText: { displayFormat: { hideDescription: true } },
                    ActivityInfluencedTID: {},
                    DamageExtentTID: { kdvKey: 'DamageExtentKDV' },
                    Comment: { displayFormat: { hideDescription: true } },
                    Urls: { displayFormat: { valueFormat: service.formatUrls } }
                }
            },
            DangerObs: {
                name: "Faretegn",
                RegistrationTID: "13",
                properties: {
                    DangerSignTID: { displayFormat: { hideDescription: true } },
                    Comment: { displayFormat: { hideDescription: true } }
                }
            },
            SnowSurfaceObservation: {
                name: "Snødekke",
                RegistrationTID: "22",
                properties: {
                    SnowDepth: { displayFormat: { valueFormat: function (item) { return $filter('number')(item * 100, 0).replace(',', '.') + ' cm' } } },
                    NewSnowDepth24: { displayFormat: { valueFormat: function (item) { return $filter('number')(item * 100, 0).replace(',', '.') + ' cm' } } },
                    NewSnowLine: { displayFormat: { valueFormat: function (item) { return item + ' moh' } } },
                    Snowline: { displayFormat: { valueFormat: function (item) { return item + ' moh' } } },
                    HeightLimitLayeredSnow: { displayFormat: { valueFormat: function (item) { return item + ' moh' } } },
                    SnowDriftTID: { displayFormat: { hideDescription: true } },
                    SurfaceWaterContentTID: {},
                    SnowSurfaceTID: {},
                    Comment: { displayFormat: { hideDescription: true } }
                }
            },
            AvalancheActivityObs: {
                name: "Skredaktivitet",
                RegistrationTID: "27"
            },
            AvalancheActivityObs2: {
                name: "Skredaktivitet",
                RegistrationTID: "33",
                properties: {
                    DtStart: { displayFormat: { hideDescription: true, valueFormat: function (item) { return moment(item).format('DD.MM.YYYY') } } },
                    DtEnd: {
                        displayFormat: {
                            condition: function (item, data) { return item && data.FullObject.DtStart },
                            valueFormat: function (item, data) {
                                var end = moment(item).format('H');
                                if (end === '23') return $translate.instant('DURING_THE_DAY');
                                return moment(data.FullObject.DtStart).format('H') + ' - ' + moment(item).format('H');
                            }
                        }
                    },
                    EstimatedNumTID: { displayFormat: { hideDescription: function (item) { return item <= 1 } } },
                    AvalancheExtTID: {},
                    AvalTriggerSimpleTID: {},
                    DestructiveSizeTID: {},
                    AvalPropagationTID: {},
                    ExposedHeightComboTID: { displayFormat: { hideDescription: true, valueFormat: service.getExposionHeightText } },
                    ValidExposition: { displayFormat: { condition: function (item) { return item !== '00000000' }, valueFormat: service.getExpositonDescriptionFromBitOrder } },
                    Comment: { displayFormat: { hideDescription: true } }
                }
            },
            AvalancheObs: {
                name: "Snøskred",
                RegistrationTID: "26",
                properties: {
                    DtAvalancheTime: { displayFormat: { hideDescription: true, valueFormat: function (item) { return moment(item).format('DD.MM.YYYY HH:mm') } } },
                    AvalancheTID: { displayFormat: { hideDescription: true } },
                    DestructiveSizeTID: {},
                    AvalancheTriggerTID: {},
                    ValidExposition: { displayFormat: { valueFormat: service.getExpositonDescriptionFromBitOrder } },
                    HeigthStartZone: { displayFormat: { condition: function (item) { return item > 0 } } },
                    TerrainStartZoneTID: {},
                    HeigthStopZone: { displayFormat: { condition: function (item) { return item > 0 } } },
                    AvalCauseTID: {},
                    FractureHeigth: { displayFormat: { valueFormat: function (item) { return item + ' cm' } } },
                    FractureWidth: { displayFormat: { valueFormat: function (item) { return item + ' m' } } },
                    Trajectory: {},
                    Comment: { displayFormat: { hideDescription: true } }
                }
            },
            WeatherObservation: {
                name: "Vær",
                RegistrationTID: "21",
                properties: {
                    PrecipitationTID: { displayFormat: { hideDescription: true } },
                    AirTemperature: { displayFormat: { hideDescription: true, valueFormat: function (item) { return item + ' °C' } } },
                    WindSpeed: { displayFormat: { valueFormat: function (item) { return item + ' m/s' } } },
                    CloudCover: { displayFormat: { valueFormat: function (item) { return item + '%' } } },
                    WindDirection: { displayFormat: { valueFormat: function (item) { return service.getWindDirectionText(item); } } },
                    Comment: { displayFormat: { hideDescription: true } }
                }
            },
            SnowProfile: {
                name: "Snøprofil",
                RegistrationTID: "23"
            },
            CompressionTest: {
                name: "Stabilitetstest",
                RegistrationTID: "25",
                properties: {
                    PropagationTID: { displayFormat: { hideDescription: true, condition: function (item, data) { return service.showStabilityTest(data.FullObject) }, valueFormat: function (item, data) { return service.formatStabilityTest(data.FullObject) } } },
                    StabilityEvalTID: {},
                    Comment: { displayFormat: { hideDescription: true } }
                }
            },
            AvalancheEvalProblem2: {
                name: "Skredproblem",
                RegistrationTID: "32",
                properties: {
                    AvalancheExtTID: {},
                    AvalCauseTID: {},
                    AvalCauseDepthTID: {},
                    AvalCauseAttributes: {
                        displayFormat: {
                            condition: function (item, data) {
                                return data.FullObject.AvalCauseAttributeCrystalTName || data.FullObject.AvalCauseAttributeLightTName || data.FullObject.AvalCauseAttributeSoftTName || data.FullObject.AvalCauseAttributeThinTName;
                            },
                            valueFormat: service.getAvalCauseAttributes
                        }
                    },
                    AvalTriggerSimpleTID: {},
                    AvalProbabilityTID: {},
                    DestructiveSizeTID: {},
                    AvalPropagationTID: {},
                    ExposedHeightComboTID: { displayFormat: { hideDescription: true, valueFormat: service.getExposionHeightText } },
                    Comment: { displayFormat: { hideDescription: true } }
                }
            },
            AvalancheEvaluation3: {
                name: "Skredfarevurdering",
                RegistrationTID: "31",
                properties: {
                    AvalancheDangerTID: {},
                    ForecastCorrectTID: { displayFormat: { hideDescription: true } },
                    AvalancheEvaluation: {},
                    AvalancheDevelopment: {},
                    ForecastComment: { displayFormat: { hideDescription: true } }
                }
            },
            Picture: {
                name: "Bilde",
                RegistrationTID: "12"
            },
            IceCoverObs: {
                name: "Isdekningsgrad",
                RegistrationTID: "51",
                properties: {
                    IceCoverTID: { displayFormat: { hideDescription: true } },
                    IceCoverBeforeTID: {},
                    IceCapacityTID: {},
                    IceSkateabilityTID: {},
                    Comment: { displayFormat: { hideDescription: true } }
                }
            },
            IceThickness: {
                name: "Snø og istykkelse",
                RegistrationTID: "50",
                properties: {
                    SnowDepth: { displayFormat: { title: 'DRY_SNOW_BEFORE_DRILL', valueFormat: function (item) { return $filter('number')(item * 100, 0).replace(',', '.') + ' cm' } } },
                    SlushSnow: { displayFormat: { valueFormat: function (item) { return $filter('number')(item * 100, 0).replace(',', '.') + ' cm' } } },
                    IceThicknessLayers: {
                        displayFormat: {
                            valueFormat: function (item) {
                                var result = [];
                                item.forEach(function (layer) {
                                    result.push($filter('number')((layer.IceLayerThickness || 0) * 100, 0).replace(',', '.') + ' cm ' + layer.IceLayerTName);
                                });
                                return result.join(', ');
                            }
                        }
                    },
                    IceThicknessSum: { displayFormat: { valueFormat: function (item) { return $filter('number')(item * 100, 0).replace(',', '.') + ' cm' } } },
                    Comment: { displayFormat: { hideDescription: true } }
                }
            },
            WaterLevel: {
                name: "Vannstand",
                RegistrationTID: "61",
                properties: {
                    WaterLevelValue: { displayFormat: { hideDescription: true, valueFormat: function (item) { return item + ' m' } } },
                    WaterLevelRefTID: {},
                    MeasuredDischarge: { displayFormat: { valueFormat: function (item) { return item + ' m³' } } },
                    Comment: { displayFormat: { hideDescription: true } }
                }
            },
            WaterLevel2: {
                name: "Vannstand",
                RegistrationTID: "62",
                properties: {
                    WaterLevelStateTID: {},
                    WaterAstrayTID: {},
                    ObservationTimingTID: {},
                    WaterLevelMethodTID: { displayFormat: { valueFormat: function (item, data) { return service.formatWaterLevelMethod(data.FullObject) } } },
                    Comment: {},
                    MeasuringToolDescription: {},
                    WaterLevelMeasurement: { displayFormat: { hideDescription: true, valueFormat: function (item, data) { return service.formatWaterLevelMeasurement(data.FullObject) } } }
                }
            },
            LandSlideObs: {
                name: "Skredhendelse",
                RegistrationTID: "71",
                properties: {
                    LandSlideTID: { displayFormat: { hideDescription: true } },
                    DtLandSlideTime: { displayFormat: { valueFormat: function (item) { return moment(item).format('DD.MM.YYYY HH:mm') } } },
                    DtLandSlideTimeEnd: { displayFormat: { valueFormat: function (item) { return moment(item).format('DD.MM.YYYY HH:mm') } } },
                    LandSlideSizeTID: {},
                    LandSlideTriggerTID: {},
                    ActivityInfluencedTID: {},
                    DamageExtentTID: { kdvKey: 'DamageExtentKDV' },
                    ForecastAccurateTID: { kdvKey: 'ForecastAccurateKDV' },
                    Comment: { displayFormat: { hideDescription: true } },
                    Urls: { displayFormat: { valueFormat: service.formatUrls } }
                }
            },
            GeneralObservation: {
                name: "Notater",
                RegistrationTID: "10",
                properties: {
                    ObsComment: { displayFormat: { hideDescription: true } }
                }
            },
            DamageObs: { //Has custom summary component in registration summary: directives/registrationdetail/summary/damageObsSummary.js
                name: "Skader",
                RegistrationTID: "14",
                properties: {
                    DamageTypeTID: { displayFormat: { hideDescription: true } },
                    DamagePosition: { displayFormat: { valueFormat: function (item) { return service.formatLatLng(item.Latitude, item.Longitude); } } },
                    Comment: { displayFormat: { hideDescription: true } }
                },
            }
        };



        service.registrationTid = function (prop) {
            var obs = OBSERVATIONS[prop];
            if (!obs) throw Error(prop + ' not found in observations!');

            return obs.RegistrationTID;
        };

        service.isObservation = function (prop) {
            return true && OBSERVATIONS[prop] && prop !== 'Picture';
        };

        service.getObservationDefinition = function (registrationTid) {
            for (var prop in OBSERVATIONS) {
                if (OBSERVATIONS.hasOwnProperty(prop)) {
                    var obs = OBSERVATIONS[prop];
                    if (obs.RegistrationTID === registrationTid.toString()) {
                        return obs;
                    }
                }
            }
            return null;
        };

        service.camelCaseToUnderscore = function (s) {
            return s.replace(/(?:^|\.?)([A-Z])/g, function (x, y) { return "_" + y.toUpperCase() }).replace(/^_/, "").toUpperCase();
        };

        service.geoHazardNames = function (tid) {
            if (!tid) return '';
            return $translate.instant(service.getGeoHazardType(tid).toUpperCase());
        };

        service.geoHazardColor = function (tid) {
            return geoHazardColors[tid];
        };

        service.getGeoHazardType = function (tid) {
            for (var prop in geoHazardTid) {
                if (geoHazardTid.hasOwnProperty(prop)) {
                    if (geoHazardTid[prop] === tid) {
                        return prop;
                    }
                }
            }
            return undefined; //not found
        };

        service.geoHazardTid = function (type) {
            return (isNaN(type) ? geoHazardTid[type] : type);
        };

        service.getCurrentGeoHazardTid = function () {
            var mode = AppSettings.getAppMode();
            return geoHazardTid[mode];
        };

        service.getGeoHazardTypes = function() {
           return angular.copy(geoHazardTid);
        };

        service.getCurrentGeoHazardName = function () {
            return $translate.instant(AppSettings.getAppMode().toUpperCase());
        };

        //Antall tegn: 8-4-4-12
        //Format: xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx
        service.createGuid = function () {
            return (S4() + S4() + "-" + S4() + "-4" + S4().substr(0, 3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
        };

        service.getKdvElements = function () {
            return service.getAppEmbeddedKdvElements()
                .then(function (result) {
                    var embeddedElements = LocalStorage.getObject('kdvDropdowns', null);
                    if (embeddedElements !== null) {
                        service._removeDeletedKdvElements(result, embeddedElements);
                        var mergedElements = angular.merge(result, embeddedElements);
                        return { data: mergedElements };
                    } else {
                        return { data: result };
                    }
                });
        };

        service.getAppEmbeddedKdvElements = function () {
            return $http.get('app/json/kdvElements.json').then(function (result) {
                return result.data;
            });
        };

        service.shouldUpdateKdvElements = function () {
            var timeDiff, diffDays;
            var lastUpdate = LocalStorage.get('kdvUpdated', '2016-01-01');
            var now = new Date();

            AppLogging.log('Last update', lastUpdate);
            if (isNaN(lastUpdate)) {
                lastUpdate = new Date('2016-01-01');
            } else {
                lastUpdate = new Date(parseInt(lastUpdate));
            }
            AppLogging.log('Last update', lastUpdate);

            timeDiff = Math.abs(now.getTime() - lastUpdate.getTime());
            diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
            AppLogging.log('Difference days', diffDays);

            return diffDays > DAYS_BEFORE_KDV_UPDATE;
        };

        service._getDropdownsFromApi = function () {
            return $http.get(AppSettings.getEndPoints().getDropdowns, { langkey: AppSettings.getCurrentLangKey() }, AppSettings.httpConfig)
                .then(function (res) {
                    return res.data;
                });
        };

        service._saveKdvElements = function (elements) {
            var newDate = Date.now();
            LocalStorage.set('kdvDropdowns', JSON.stringify(elements));
            LocalStorage.set('kdvUpdated', newDate);
            $rootScope.$broadcast('kdvUpdated', newDate);
        };

        service._removeDeletedKdvElements = function (oldKdvElements, newKdvElements) {
            for (var prop in oldKdvElements.KdvRepositories) {
                if (newKdvElements.KdvRepositories.hasOwnProperty(prop)) {
                    var values = oldKdvElements.KdvRepositories[prop];
                    var existsInNewElements = function (item) {
                        return newKdvElements.KdvRepositories[prop].filter(function (ne) {
                            return ne.Id === item.Id;
                        }).length > 0;
                    };
                    var keep = [];
                    values.forEach(function (item) {
                        if (existsInNewElements(item)) {
                            keep.push(item);
                        }
                    });
                    oldKdvElements.KdvRepositories[prop] = keep;
                }
            }
        };

        service._refreshKdvElements = function () {
            return service._getDropdownsFromApi()
                .then(function (newKdvElements) {
                    return service.getKdvElements().then(function (response) { //Getting old values to update
                        var oldKdvElements = response.data;
                        //remove items missing in new elements (deleted items)
                        service._removeDeletedKdvElements(oldKdvElements, newKdvElements);
                        var mergedElements = angular.merge(oldKdvElements, newKdvElements);
                        service._saveKdvElements(mergedElements);
                    });
                });
        };

        service.refreshKdvElements = function () {
            User.refreshObserverGroups();
            return service._refreshKdvElements();
        };

        service.getKdvRepositories = function () {
            return service
                .getKdvElements()
                .then(function (response) {
                    return response.data.KdvRepositories;
                });
        };

        service.getViewRepositories = function () {
            return service
                .getKdvElements()
                .then(function (response) {
                    return response.data.ViewRepositories;
                });
        };

        service._filterZeroKdvElements = function (arr) {
            if (!angular.isArray(arr)) {
                return arr;
            }

            return arr.filter(function (item) { return item.Id > 0 && item.Id % 100 !== 0; });
        };

        service.getKdvArray = function (key, keepZero) {
            return service
                .getKdvRepositories()
                .then(function (KdvRepositories) {
                    var arr = KdvRepositories[key];
                    return keepZero ? arr : service._filterZeroKdvElements(arr);
                });
        };

        service._getKdvValue = function (id, arr) {
            var result = arr.filter(function (item) {
                return item.Id === id;
            });
            if (result.length > 0) {
                return result[0];
            } else {
                return null;
            }
        };

        service.getKdvValue = function (key, id) {
            return service.getKdvArray(key)
                .then(function (arr) {
                    return service._getKdvValue(id, arr);
                });
        };

        service.twoDecimal = function (num) {
            return service.nDecimal(num, 2);
        };

        service.nDecimal = function (num, n) {
            AppLogging.log(num);
            return parseFloat(num.toFixed(n));
        };

        service.isEmpty = function (obj) {

            // null and undefined are "empty"
            if (obj === null || obj === undefined || obj === '') return true;

            //if object is string/boolena/number and not null, undefined or '' return false
            if (typeof obj === 'string' || typeof obj === 'boolean' || typeof obj === 'number') {
                return false;
            }

            //if object is array, check array length
            if (angular.isArray(obj)) {
                if (obj.length === 0) {
                    return true;
                } else {
                    var any = [];
                    obj.forEach(function (item) {
                        if (item) {
                            var dataJson = angular.toJson(item);
                            var obj = JSON.parse(dataJson);
                            if (!service.isEmpty(obj)) {
                                any.push(obj);
                            }
                        }
                    });

                    return any.length === 0;
                }
            }


            var props = [];
            //if object has properties, check if any has value
            for (var key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    props.push(key);
                    if (!service.isEmpty(obj[key])) {
                        return false;
                    }
                }
            }

            if (props.length > 0) {
                return true; //object has properties, but all is empty
            } else {
                return JSON.stringify(obj) === JSON.stringify({}); //final check to see if object is empty
            }
        };

        service.resizeImage = function resizeImage(longSideMax, url, callback) {
            var tempImg = new Image();
            tempImg.src = url;
            tempImg.onload = function () {
                // Get image size and aspect ratio.
                var targetWidth = tempImg.width;
                var targetHeight = tempImg.height;
                var aspect = tempImg.width / tempImg.height;

                // Calculate shorter side length, keeping aspect ratio on image.
                // If source image size is less than given longSideMax, then it need to be
                // considered instead.
                if (tempImg.width > tempImg.height) {
                    longSideMax = Math.min(tempImg.width, longSideMax);
                    targetWidth = longSideMax;
                    targetHeight = longSideMax / aspect;
                }
                else {
                    longSideMax = Math.min(tempImg.height, longSideMax);
                    targetHeight = longSideMax;
                    targetWidth = longSideMax * aspect;
                }

                // Create canvas of required size.
                if (!canvas) canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                var ctx = canvas.getContext("2d");
                // Take image from top left corner to bottom right corner and draw the image
                // on canvas to completely fill into.
                ctx.drawImage(this, 0, 0, tempImg.width, tempImg.height, 0, 0, targetWidth, targetHeight);

                callback(canvas.toDataURL("image/jpeg", 0.4));
            };
        };

        service.resizeAllImages = function (data) {
            var deferred = $q.defer();
            var picturePresent = 0, i, reg;
            if (angular.isArray(data)) {
                for (i = 0; i < data.length; i++) {
                    reg = data[i];
                    if (reg.Picture && angular.isArray(reg.Picture)) {
                        picturePresent += reg.Picture.length;
                        reg.Picture.forEach(function (pic) {
                            service.resizeImage(AppSettings.imageSize, pic.PictureImageBase64, function (imageData) {
                                pic.PictureImageBase64 = imageData;
                                picturePresent = picturePresent - 1;
                                if (!picturePresent) {
                                    deferred.resolve(data);
                                }
                            });
                        });
                        AppLogging.log(reg.Picture);
                    }
                }
            }


            if (!picturePresent) {
                deferred.resolve(data);
            }

            return deferred.promise;
        };

        function S4() {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        }

        service.humanFileSize = function (bytes, si) {
            var thresh = si ? 1000 : 1024;
            if (Math.abs(bytes) < thresh) {
                return bytes + ' B';
            }
            var units = si
                ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
                : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
            var u = -1;
            do {
                bytes /= thresh;
                ++u;
            } while (Math.abs(bytes) >= thresh && u < units.length - 1);
            return bytes.toFixed(1) + ' ' + units[u];
        };

        /**
         * Is ripple emulator running?
         * @returns {boolean} - true if ripple emulator is running 
         */
        service.isRippleEmulator = function () {
            //return window.parent && window.parent.ripple;
            return !((window.cordova || window.PhoneGap || window.phonegap)
                && /^file:\/{3}[^\/]/i.test(window.location.href)
                && /ios|iphone|ipod|ipad|android/i.test(navigator.userAgent));
        };

        service.isString = function (obj) {
            return typeof obj === 'string' || obj instanceof String;
        };


        service.hasMinimumNetwork = function () {
            if (service.isRippleEmulator() || typeof Connection === 'undefined') {
                return true;
            }
            var status = $cordovaNetwork.getNetwork();
            return status !== Connection.NONE && status !== Connection.CELL;
        };

        service.hasGoodNetwork = function () {
            if (service.isRippleEmulator() || typeof Connection === 'undefined') {
                return true;
            }

            var status = $cordovaNetwork.getNetwork();
            return status === Connection.CELL_3G || status === Connection.CELL_4G || status === Connection.WIFI || status === Connection.ETHERNET || status === Connection.UNKNOWN;
        };


        /**
         * Get distance text formatted in km or meter depending on how large the distance value is
         * @param {} distance in meter
         * @returns {} km or meter distance text
         */
        service.getDistanceText = function (distance) {
            var dText;
            if (distance > 1000) {
                dText = (distance / 1000).toFixed(1) + ' km';
            } else {
                dText = (distance || 0).toFixed(0) + ' m';
            }
            return dText;
        };

        service.getRadiusFromBounds = function (bounds) {
            return parseInt((bounds.getNorthWest().distanceTo(bounds.getSouthEast()) / 2).toFixed(0));
        };

        service.formatLatLng = function (lat, lng, decimals) {
            return $filter('number')(lat, decimals || 5) + ', ' + $filter('number')(lng, decimals || 5);
        };

        /**
        * Format lat lng as degrees, minutes, seconds
        */
        service.ddToDms = function (lat, lng) {
            var _lat, _lng, latResult, lngResult, dmsResult;

            if (typeof lat === 'string') {
                _lat = parseFloat(lat);
            } else {
                _lat = lat;
            }
            if (typeof lng === 'string') {
                _lng = parseFloat(lng);
            } else {
                _lng = lng;
            }

            // Call to getDms(lat) function for the coordinates of Latitude in DMS.
            // The result is stored in latResult variable.
            latResult = service._getDms(_lat);
            latResult += (_lat >= 0) ? 'N' : 'S';


            // Call to getDms(lng) function for the coordinates of Longitude in DMS.
            // The result is stored in lngResult variable.
            lngResult = service._getDms(_lng);
            lngResult += (_lng >= 0) ? 'E' : 'W';

            // Joining both variables and separate them with a space.
            dmsResult = latResult + ', ' + lngResult;

            // Return the resultant string
            return dmsResult;
        };

        service._getDms = function (val) {

            var valDeg, valMin, valSec, result;

            val = Math.abs(val);

            valDeg = Math.floor(val);
            result = valDeg + "º";

            valMin = Math.floor((val - valDeg) * 60);
            result += valMin + "'";

            valSec = Math.round((val - valDeg - valMin / 60) * 3600 * 1000) / 1000;
            result += valSec + '"';

            return result;
        };

        service.setBackView = function (name) {
            var backName = name || 'start';
            var historyId = $ionicHistory.currentHistoryId();
            var history = $ionicHistory.viewHistory().histories[historyId];
            var found = false;
            for (var i = history.stack.length - 1; i >= 0; i--) {
                if (history.stack[i].stateName === backName) {
                    found = true;
                    $ionicHistory.backView(history.stack[i]);
                }
            }
        };

        service.formatDate = function (date) {
            return $filter('date')(date, 'd') + '. ' + $filter('lowercase')($filter('translate')($filter('uppercase')($filter('date')(date, 'MMM')))) + ' ' + $filter('date')(date, 'yyyy');
        };

        service.formatDateAndTime = function (date) {
            return service.formatDate(date) + ', ' + $filter('date')(date, 'HH:mm');
        };

        service.getVersion = function () {
            return $http.get('app/json/version.json')
                .then(function (res) {
                    return res.data;
                });
        };

        service.configureRaven = function () {
            service.getVersion().then(function (version) {
                Raven.setShouldSendCallback(function () { return /*AppSettings.data.env !== 'test regObs' &&*/ !service.isRippleEmulator() });
                Raven.setEnvironment(AppSettings.data.env);
                Raven.setRelease(version.version + ' - ' + version.build);

                var user = User.getUser();
                if (!user.anonymous) {
                    Raven.setUserContext({
                        email: user.email,
                        id: user.Guid
                    })
                }
            });
        };

        service.clearRegistrationCacheViews = function () {
            var states = $state.get();
            var registrationStates = states.filter(function (item) {
                return item.data && item.data.registrationProp; //Clearing all registration views from cache
            });
            var cacheToClear = ['newregistration', 'confirmlocation', 'confirmtime'];
            registrationStates.forEach(function (item) {
                cacheToClear.push(item.name);
            });

            return $ionicHistory.clearCache(cacheToClear);
        };

        return service;

    });