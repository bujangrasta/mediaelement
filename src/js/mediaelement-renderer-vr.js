/**
 * VR renderer
 *
 * It uses Google's VR View and creates an <iframe> that allows the user to see 360 videos
 * @see https://developers.google.com/vr/concepts/vrview-web
 */
(function (win, doc, mejs, undefined) {

	var VrAPI = {
		/**
		 * @type {Boolean}
		 */
		isMediaStarted: false,
		/**
		 * @type {Boolean}
		 */
		isMediaLoaded: false,
		/**
		 * @type {Array}
		 */
		creationQueue: [],

		/**
		 * Create a queue to prepare the loading of the VR View Player
		 * @param {Object} settings - an object with settings needed to load an VR View Player instance
		 */
		prepareSettings: function (settings) {
			if (this.isLoaded) {
				this.createInstance(settings);
			} else {
				this.loadScript();
				this.creationQueue.push(settings);
			}
		},

		/**
		 * Load vrview.min.js script on the header of the document
		 *
		 */
		loadScript: function () {
			if (!this.isMediaStarted) {

				var
					script = doc.createElement('script'),
					firstScriptTag = doc.getElementsByTagName('script')[0],
					done = false;

				script.src = 'https://storage.googleapis.com/vrview/2.0/build/vrview.min.js';

				// Attach handlers for all browsers
				script.onload = script.onreadystatechange = function () {
					if (!done && (!this.readyState || this.readyState === undefined ||
						this.readyState === 'loaded' || this.readyState === 'complete')) {
						done = true;
						VrAPI.mediaReady();
						script.onload = script.onreadystatechange = null;
					}
				};

				firstScriptTag.parentNode.insertBefore(script, firstScriptTag);
				this.isMediaStarted = true;
			}
		},

		/**
		 * Process queue of VR View Player creation
		 *
		 */
		mediaReady: function () {
			this.isLoaded = true;
			this.isMediaLoaded = true;

			while (this.creationQueue.length > 0) {
				var settings = this.creationQueue.pop();
				this.createInstance(settings);
			}
		},

		/**
		 * Create a new instance of VrView player and trigger a custom event to initialize it
		 *
		 * @param {Object} settings - an object with settings needed to instantiate VR View Player object
		 */
		createInstance: function (settings) {
			win.addEventListener('load', function() {
				var player = new VRView.Player('#' + settings.id, settings.options);
				win['__ready__' + settings.id](player);
			});
		}
	};

	var VrRenderer = {
		name: 'vr',

		options: {
			prefix: 'vr',
			/**
			 * https://developers.google.com/vr/concepts/vrview-web#vr_view
			 */
			vr: {
				image: '',
				is_stereo: true,
				is_autopan_off: true,
				is_debug: false,
				is_vr_off: false,
				default_yaw: 0,
				is_yaw_only: false
			}
		},

		/**
		 * Determine if a specific element type can be played with this render
		 *
		 * @param {String} type
		 * @return {Boolean}
		 */
		canPlayType: function (type) {
			var mediaTypes = ['video/mp4', 'application/x-mpegURL', 'application/x-mpegurl',
				'vnd.apple.mpegURL', 'video/hls', 'application/dash+xml'];

			return mediaTypes.indexOf(type) > -1;
		},
		/**
		 * Create the player instance and add all native events/methods/properties as possible
		 *
		 * @param {MediaElement} mediaElement Instance of mejs.MediaElement already created
		 * @param {Object} options All the player configuration options passed through constructor
		 * @param {Object[]} mediaFiles List of sources with format: {src: url, type: x/y-z}
		 * @return {Object}
		 */
		create: function (mediaElement, options, mediaFiles) {

			// exposed object
			var
				apiStack = [],
				VrAPIReady = false,
				vr = {},
				vrPlayer = null,
				paused = false,
				volume = 1,
				oldVolume = volume,
				currentTime = 0,
				bufferedTime = 0,
				ended = false,
				duration = 0,
				url = "",
				i,
				il;

			vr.options = options;
			vr.id = mediaElement.id + '_' + options.prefix;
			vr.mediaElement = mediaElement;

			// wrappers for get/set
			var
				props = mejs.html5media.properties,
				assignGettersSetters = function (propName) {

					var capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

					vr['get' + capName] = function () {
						if (vrPlayer !== null) {
							var value = null;

							switch (propName) {
								case 'currentTime':
									return currentTime;

								case 'duration':
									return duration;

								case 'volume':
									return volume;
								case 'muted':
									return volume === 0;
								case 'paused':
									paused = vrPlayer.isPaused;
									return paused;

								case 'ended':
									return ended;

								case 'src':
									return url;

								case 'buffered':
									return {
										start: function () {
											return 0;
										},
										end: function () {
											return bufferedTime * duration;
										},
										length: 1
									};
							}

							return value;
						} else {
							return null;
						}
					};

					vr['set' + capName] = function (value) {

						if (vrPlayer !== null) {

							// do something
							switch (propName) {

								case 'src':
									var url = typeof value === 'string' ? value : value[0].src;
									vrPlayer.setContentInfo({ video: url });
									break;

								case 'currentTime':
									vrPlayer.setCurrentTime(value);
									break;

								case 'volume':
									vrPlayer.setVolume(value);
									break;
								case 'muted':
									if (value) {
										vrPlayer.setVolume(0);
									} else {
										vrPlayer.setVolume(oldVolume);
									}
									break;
								default:
									console.log('vr ' + vr.id, propName, 'UNSUPPORTED property');
							}

						} else {
							// store for after "READY" event fires
							apiStack.push({type: 'set', propName: propName, value: value});
						}
					};

				}
				;
			for (i = 0, il = props.length; i < il; i++) {
				assignGettersSetters(props[i]);
			}

			// add wrappers for native methods
			var
				methods = mejs.html5media.methods,
				assignMethods = function (methodName) {

					// run the method on the Soundcloud API
					vr[methodName] = function () {

						if (vrPlayer !== null) {

							// DO method
							switch (methodName) {
								case 'play':
									return vrPlayer.play();
								case 'pause':
									return vrPlayer.pause();
								case 'load':
									return null;

							}

						} else {
							apiStack.push({type: 'call', methodName: methodName});
						}
					};

				}
				;
			for (i = 0, il = methods.length; i < il; i++) {
				assignMethods(methods[i]);
			}

			// Initial method to register all VRView events when initializing <iframe>
			win['__ready__' + vr.id] = function (_vrPlayer) {

				VrAPIReady = true;
				mediaElement.vrPlayer = vrPlayer = _vrPlayer;

				vrPlayer.on('ready', function() {

					vrPlayer.pause();

					// a few more events
					events = ['mouseover', 'mouseout'];

					var assignEvents = function (e) {
						var event = mejs.Utils.createEvent(e.type, vr);
						mediaElement.dispatchEvent(event);
					};

					for (var j in events) {
						var eventName = events[j];
						mejs.addEvent(vrPlayer, eventName, assignEvents);
					}

					// give initial events
					events = ['rendererready', 'loadeddata', 'loadedmetadata', 'canplay'];

					for (i = 0, il = events.length; i < il; i++) {
						var event = mejs.Utils.createEvent(events[i], vr);
						mediaElement.dispatchEvent(event);
					}
				});
			};

			var vrContainer = doc.createElement('div');

			// Create <iframe> markup
			vrContainer.setAttribute('id', vr.id);
			vrContainer.style.width = '100%';
			vrContainer.style.height = '100%';

			mediaElement.originalNode.parentNode.insertBefore(vrContainer, mediaElement.originalNode);
			mediaElement.originalNode.style.display = 'none';

			if (mediaFiles && mediaFiles.length > 0) {
				for (i = 0, il = mediaFiles.length; i < il; i++) {
					if (mejs.Renderers.renderers[options.prefix].canPlayType(mediaFiles[i].type)) {
						options.vr.video = mediaFiles[i].src;
						options.vr.width = '100%';
						options.vr.height = '100%';
						break;
					}
				}
			}

			VrAPI.prepareSettings({
				options: options.vr,
				id: vr.id
			});

			vr.hide = function () {
				vr.pause();
				if (vrPlayer) {
					vrContainer.style.display = 'none';
				}
			};
			vr.setSize = function (width, height) {

			};
			vr.show = function () {
				if (vrPlayer) {
					vrContainer.style.display = '';
				}
			};

			return vr;
		}
	};

	mejs.Renderers.add(VrRenderer);

})(window, document, window.mejs || {});