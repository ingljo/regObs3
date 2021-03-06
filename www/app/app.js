(function () {
    "use strict";
    angular.module('RegObs', ['ionic', 'ngCordova', 'ion-floating-menu', 'angularProgressbar', 'pascalprecht.translate', 'ngWebworker', 'ionic.closePopup', 'ngRaven', 'ng-showdown'])
        .config(providers)
        .run(setup);

    function providers($provide, $stateProvider, $urlRouterProvider, $ionicConfigProvider, AppSettingsProvider, $translateProvider, UserProvider, UtilityProvider) {
        'ngInject';

        if (ionic.Platform.isAndroid()) {
            $ionicConfigProvider.scrolling.jsScrolling(false);
        }

        var langMap = {
            'nb_NO': 'no'
        };

        $translateProvider.useSanitizeValueStrategy('escapeParameters')
            .useStaticFilesLoader({
                prefix: './app/json/localization/',
                suffix: '.json'
            }).registerAvailableLanguageKeys(['no'], langMap)
            .preferredLanguage('no')
            .fallbackLanguage(['no']);


        if (!AppSettingsProvider.$get().hasSetAppMode()) {
            $urlRouterProvider.otherwise('/wizard');
        } else {
            $urlRouterProvider.otherwise('/start');
        }

        $ionicConfigProvider.views.swipeBackEnabled(false); //turn off swipe back (map interactions often swipes back)
        $ionicConfigProvider.backButton.previousTitleText(false).text('&emsp;&emsp;'); //Increase the touch target area on back button

        $stateProvider
            .state('wizard', {
                url: '/wizard',
                templateUrl: 'app/startwizard/startwizard.html',
                controller: 'StartWizardCtrl as vm',
                cache: false
            })
            .state('start', {
                url: '/start',
                templateUrl: 'app/map/mapstart.html',
                controller: 'MapStartCtrl as vm'
            })
            .state('login', {
                url: '/login',
                templateUrl: 'app/login/loginview.html',
                controller: 'LoginViewCtrl as vm'
            })
            .state('settings', {
                url: '/settings',
                templateUrl: 'app/settings/settingsview.html',
                controller: 'SettingsViewCtrl as vm'
            })
            .state('offlinemapoverview', {
                url: '/offlinemapoverview',
                templateUrl: 'app/map/offlinemapoverview.html',
                controller: 'OfflineMapOverviewCtrl as vm'
            })
            .state('mapareadownload', {
                url: '/mapareadownload',
                templateUrl: 'app/map/mapareadownload.html',
                controller: 'MapAreaDownloadCtrl as vm',
                cache: false
            })
            .state('offlineareadetails', {
                url: '/offlineareadetails',
                templateUrl: 'app/map/offlineareadetails.html',
                controller: 'OfflineAreaDetailsCtrl as vm',
                cache: false,
                params: { area: null }
            })

            .state('observationdetails', {
                url: '/observationdetails',
                templateUrl: 'app/observations/details/observationdetails.html',
                controller: 'ObservationDetailsCtrl as vm',
                cache: false,
                params: { observation: null }
            })

            .state('observationlist', {
                url: '/observationlist',
                templateUrl: 'app/observations/list/observationlist.html',
                controller: 'ObservationListCtrl as vm'
            })

            .state('userobservations', {
                url: '/userobservations',
                templateUrl: 'app/observations/user/userobservations.html',
                controller: 'UserObservationsCtrl as vm'
            })

            .state('confirmlocation', {
                url: '/confirmlocation',
                templateUrl: 'app/registration/location/confirmlocation.html',
                controller: 'ConfirmLocationCtrl as vm',
                cache: false
            })

            .state('confirmtime', {
                url: '/confirmtime',
                templateUrl: 'app/registration/time/confirmtime.html',
                controller: 'ConfirmTimeCtrl as vm'
            })

            .state('setgroup', {
                url: '/setgroup',
                templateUrl: 'app/registration/group/group.html',
                controller: 'SetGroupCtrl as vm'
            })

            .state('newregistration', {
                url: '/newregistration',
                templateUrl: 'app/registration/registration.html',
                controller: 'RegistrationCtrl as vm'
            })

            .state('registrationstatus', {
                url: '/registrationstatus',
                templateUrl: 'app/registration/status/registrationstatus.html',
                controller: 'RegistrationStatusCtrl as vm',
                params: { observation: null },
                cache: false
            })

            //SNØ
            .state('snowtrip', {
                url: '/snowtrip',
                templateUrl: 'app/snow/trip/trip.html',
                controller: 'TripCtrl as vm'
            })
            .state('snowdangerobs', {
                //Faretegn
                url: '/snowdangerobs',
                templateUrl: 'app/snow/snowregistration/snowdangerobs/snowdangerobs.html',
                controller: 'SnowDangerObsCtrl as vm',
                data: {
                    registrationProp: 'DangerObs'
                }
            })
            .state('stabilitytest', {
                //Stabilitetstest
                url: '/stabilitytest',
                templateUrl: 'app/snow/snowregistration/stabilitytest/stabilitytest.html',
                controller: 'SnowStabilityTestCtrl as vm',
                data: {
                    registrationProp: 'CompressionTest'
                }
            })
            .state('avalancheobs', {
                //Skredhendelse
                url: '/avalancheobs',
                templateUrl: 'app/snow/snowregistration/avalancheobs/avalancheobs.html',
                controller: 'AvalancheObsCtrl as vm',
                data: {
                    registrationProp: 'AvalancheObs'
                }
            })
            .state('avalancheactivityobs', {
                //Skredaktivitet
                url: '/avalancheactivityobs',
                templateUrl: 'app/snow/snowregistration/avalancheactivityobs/avalancheactivityobs.html',
                controller: 'AvalancheActivityObsCtrl as vm',
                data: {
                    registrationProp: 'AvalancheActivityObs2'
                }
            })
            .state('snowweatherobservation', {
                //Vær
                url: '/snowweatherobservation',
                templateUrl: 'app/snow/snowregistration/snowweatherobservation/snowweatherobservation.html',
                controller: 'SnowWeatherObservationCtrl as vm',
                data: {
                    registrationProp: 'WeatherObservation'
                }
            })
            .state('snowsurfaceobservation', {
                //Snødekke
                url: '/snowsurfaceobservation',
                templateUrl: 'app/snow/snowregistration/snowsurfaceobservation/snowsurfaceobservation.html',
                controller: 'SnowSurfaceObservationCtrl as vm',
                data: {
                    registrationProp: 'SnowSurfaceObservation'
                }
            })
            .state('snowprofile', {
                //Snøprofil
                url: '/snowprofile',
                templateUrl: 'app/snow/snowregistration/snowprofile/snowprofile.html',
                controller: 'SnowProfileCtrl as vm',
                data: {
                    registrationProp: 'SnowProfile'
                }
            })
            .state('avalancheevalproblem', {
                //Skredproblem
                url: '/avalancheevalproblem',
                templateUrl: 'app/snow/snowregistration/avalancheevalproblem/avalancheevalproblem.html',
                controller: 'AvalancheEvalProblemCtrl as vm',
                data: {
                    registrationProp: 'AvalancheEvalProblem2'
                }
            })
            .state('avalancheevaluation', {
                //Skredfarevurdering
                url: '/avalancheevaluation',
                templateUrl: 'app/snow/snowregistration/avalancheevaluation/avalancheevaluation.html',
                controller: 'AvalancheEvaluationCtrl as vm',
                data: {
                    registrationProp: 'AvalancheEvaluation3'
                }
            })

            //IS
            .state('icedangerobs', {
                //Faretegn
                url: '/icedangerobs',
                templateUrl: 'app/ice/iceregistration/icedangerobs/icedangerobs.html',
                controller: 'IceDangerObsCtrl as vm',
                data: {
                    registrationProp: 'DangerObs'
                }
            })
            .state('icecoverobs', {
                //Isdekningsgrad
                url: '/icecoverobs',
                templateUrl: 'app/ice/iceregistration/icecoverobs/icecoverobs.html',
                controller: 'IceCoverObsCtrl as vm',
                data: {
                    registrationProp: 'IceCoverObs'
                }
            })
            .state('icethickness', {
                //Istykkelse
                url: '/icethickness',
                templateUrl: 'app/ice/iceregistration/icethickness/icethickness.html',
                controller: 'IceThicknessCtrl as vm',
                data: {
                    registrationProp: 'IceThickness'
                }
            })
            .state('iceincident', {
                //Ulykke/hendelse
                url: '/iceincident',
                templateUrl: 'app/ice/iceregistration/iceincident/iceincident.html',
                controller: 'IceIncidentCtrl as vm',
                data: {
                    registrationProp: 'Incident'
                }
            })

            //VANN
            .state('waterlevel', {
                //Faretegn
                url: '/waterlevel',
                templateUrl: 'app/water/waterregistration/waterlevel/waterlevel.html',
                controller: 'WaterLevelCtrl as vm',
                data: {
                    registrationProp: 'WaterLevel2'
                }
            })

            //JORD
            .state('dirtdangerobs', {
                //Faretegn
                url: '/dirtdangerobs',
                templateUrl: 'app/dirt/dirtregistration/dirtdangerobs/dirtdangerobs.html',
                controller: 'DirtDangerObsCtrl as vm',
                data: {
                    registrationProp: 'DangerObs'
                }
            })
            .state('landslideobs', {
                //Skredhendelse
                url: '/landslideobs',
                templateUrl: 'app/dirt/dirtregistration/landslideobs/landslideobs.html',
                controller: 'LandSlideObsCtrl as vm',
                data: {
                    registrationProp: 'LandSlideObs'
                }
            })

            //Felles
            .state('generalobs', {
                //Fritekst
                url: '/generalobs',
                templateUrl: 'app/generalobs/generalobs.html',
                controller: 'GeneralObsCtrl as vm',
                data: {
                    registrationProp: 'GeneralObservation'
                }
            })

            .state('generalobs2', {
                //Fritekst
                url: '/generalobs2',
                templateUrl: 'app/generalobs/generalobs2.html',
                controller: 'GeneralObsCtrl2 as vm',
                data: {
                    registrationProp: 'GeneralObservation'
                }
            })

            .state('damageobs', {
                //Fritekst
                url: '/damageobs',
                templateUrl: 'app/generalobs/damageobs.html',
                controller: 'DamageObsCtrl as vm',
                data: {
                    registrationProp: 'DamageObs'
                }
            })

            .state('confirmdamagelocation', {
                url: '/confirmdamagelocation',
                templateUrl: 'app/generalobs/damageobsposition.html',
                controller: 'DamageObsPositionCtrl as vm',
                params: { damageObs: null },
                cache: false
            })

            .state('help', {
                url: '/help/:page',
                templateUrl: function (stateParams) {
                    return 'app/help/' + stateParams.page + '.html';
                },
                controller: 'HelpCtrl as vm',
                data: { skipValidation: true }
            })

            .state('dynamichelp', {
                url: '/dynamichelp/:registrationProp',
                templateUrl: 'app/help/dynamichelp.html',
                controller: 'HelpCtrl as vm',
                data: { skipValidation: true }
            });
    }

    function setup($ionicPlatform, Utility, AppLogging, Registration, Observations, OfflineMap, $http, User, HelpTexts) {
        'ngInject';

        $ionicPlatform.ready(function () {

           

            // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
            // for form inputs)*/
            if (window.cordova && window.cordova.plugins.Keyboard) {
                cordova.plugins.Keyboard.hideKeyboardAccessoryBar(false);
                cordova.plugins.Keyboard.disableScroll(true);
            }

            if (window.StatusBar) {
                StatusBar.styleLightContent();
            }

            document.addEventListener("deviceready", function () {
                Utility.configureRaven();
                Registration.clearNewRegistrations();
                Observations.removeOldObservationsFromPresistantStorage(); //cleanup old observations on startup

                if (Utility.hasGoodNetwork() && Utility.shouldUpdateKdvElements()) {
                    Utility.refreshKdvElements();
                    HelpTexts.updateHelpTexts();
                }              
                
                OfflineMap.checkUncompleteDownloads(); //Check if any uncomplete downloads and continue download progress
            });
        });

        $ionicPlatform.on('resume', function () {
            Registration.setBadge(); //Update badge on app resume
        });
    }
})();
