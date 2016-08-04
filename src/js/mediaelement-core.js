"use strict";

(function(mejs, win, doc, undef) {

// HTML5 Media API that will be mimiced
mejs.html5media = {
	properties: [
				// GET/SET
				'volume', 'src', 'currentTime', 'muted'

				// GET only
				,'duration', 'paused', 'ended'

				// OTHERS
				,'error','currentSrc','networkState','preload','buffered','bufferedBytes','bufferedTime','readyState','seeking',
				'initialTime','startOffsetTime','defaultPlaybackRate','playbackRate','played','seekable','autoplay','loop','controls'
				],

	methods:  	[
				'load', 'play', 'pause', 'canPlayType'
				],

	events:  	[
				'loadstart', 'progress', 'suspend', 'abort', 'error', 'emptied', 'stalled', 'play', 'pause', 'loadedmetadata',
				'loadeddata', 'waiting', 'playing', 'canplay', 'canplaythrough', 'seeking', 'seeked', 'timeupdate', 'ended', 'ratechange', 'durationchange', 'volumechange'
				],

	mediaTypes: [
				'audio/mp3','audio/ogg','audio/oga','audio/wav','audio/mpeg'
				,'video/mp4','video/webm','video/ogg'
				]
}


// a list of possible renderers (HTML5, Flash, YouTube, Soundcloud, pure JS, etc.)
mejs.Renderers = {

	renderers: {},

	order: [],

	// register a new renderer
	add: function(renderer) {
		this.renderers[renderer.name] = renderer;
		this.order.push(renderer.name);
	},

	// go through the renders and return the first one that supports the given type
	// accepts string:type
	// or array [{src:'',type:''}]
	getRendererByType: function(mediaType) {
		var t = this;

		for (var i=0, il=t.order.length; i<il; i++) {
			var rendererName = t.order[i],
				renderer = t.renderers[rendererName];

			if (render.canPlayType(mediaType) != '') {
				return rendererName;
			}
		}

		return null;
	},

	// array [{src:'',type:''}]
	selectRenderer: function(mediaFiles) {
		var t = this;

		for (var i=0, il=t.order.length; i<il; i++) {
			var rendererName = t.order[i],
				renderer = t.renderers[rendererName];

			for (var j=0, jl=mediaFiles.length; j<jl; j++) {
				if (renderer.canPlayType(mediaFiles[j].type) != '' ) {
					return {
						rendererName: rendererName,
						src: mediaFiles[j].src
					}
				}
			}
		}

		return null;
	},

	getRendererByUrl: function(url) {
		return this.getRendererByType( mejs.Utils.getTypeFromFile(url) );
	}
};

mejs.MediaElementOptionsDefaults = {
	renderers: [],
	fakeNodeName: 'mediaelementwrapper',
	pluginPath: 'build/'
}

// Outside Wrapper returns a fake DOM element with properties that look like
// a real HTMLMediaElement
mejs.MediaElement = function (idOrNode, options) {

	options = mejs.Utils.extend( mejs.MediaElementOptionsDefaults, options );
	
	// create our node (note: older versions of iOS don't support Object.defineProperty on DOM nodes)	
	var	mediaElement = doc.createElement(options.fakeNodeName);

	mediaElement.options = options;
	
	var id = idOrNode;
	
	if (typeof idOrNode === 'string') {
		mediaElement.originalNode = doc.getElementById(idOrNode);
	} else {
		mediaElement.originalNode = idOrNode;
		id = idOrNode.id;
	}

	id = id || 'mejs_' + Math.random().toString().slice(2);

	if (mediaElement.originalNode !== null && mediaElement.appendChild) {
		// change id
		mediaElement.originalNode.setAttribute('id', id + '_from_mejs');

		// add next to this one
		mediaElement.originalNode.parentNode.insertBefore(mediaElement, mediaElement.originalNode);

		// insert this one inside
		mediaElement.appendChild(mediaElement.originalNode);
	} else {
		// TODO: where to put the node?
	}

	mediaElement.id = id;

	mediaElement.renderers = {};
	mediaElement.renderer = null;
	mediaElement.rendererName = null;

	// add properties get/set
	var props = mejs.html5media.properties;
	for (var i=0, il=props.length; i<il; i++) {

		// wrap in function to retain scope
		(function(propName) {

			// src is a special one below
			if (propName != 'src') {

				var capName = propName.substring(0,1).toUpperCase() + propName.substring(1),

					getFn = function() {
						//console.log('[wrapper get]: ' + propName);

						if (mediaElement.renderer != null) {
							return mediaElement.renderer['get' + capName]();

							//return mediaElement.renderer[propName];
						} else {
							return null;
						}
					},
					setFn = function(value) {
						//console.log('[wrapper set]: ' + propName + ' = ' + value);

						if (mediaElement.renderer != null) {
							mediaElement.renderer['set' + capName](value);

							//mediaElement.renderer[propName] = value;
						}
					};

				mejs.Utils.addProperty(mediaElement, propName, getFn, setFn)

				mediaElement['get' + capName] = getFn;
				mediaElement['set' + capName] = setFn;
			}

		})(props[i]);
	}

	// special .src property
	var getSrc = function() {
			//console.log('[wrapper get]: SRC');

			if (mediaElement.renderer != null) {
				return mediaElement.renderer.getSrc();
			} else {
				return null;
			}
		},
		setSrc = function(value) {
			//console.log('[wrapper set]: SRC: ', value);

			var renderInfo,
				mediaFiles = [];

			// clean up URLs
			if (typeof value == 'string') {
				mediaFiles.push({
								src: value,
								type: mejs.Utils.getTypeFromFile(value)
							});
			} else {
				for (i=0, il=value.length; i<il; i++) {

					var src = mejs.Utils.absolutizeUrl( value[i].src ),
						type = value[i].type;

					mediaFiles.push({
									src: src,
									type: (type == '' || type === null || typeof type == 'undefined') ? mejs.Utils.getTypeFromFile(src) : type
								});

				}
			}

			//console.log('SRC test', mediaFiles);

			// find a renderer and URL match
			renderInfo = mejs.Renderers.selectRenderer( mediaFiles );

			//console.log('SRC selection', renderInfo);

			// did we find a renderer?
			if (renderInfo === null) {
				var event = document.createEvent("HTMLEvents");
				event.initEvent('error', false, false);
				event.message = 'No renderer found';
				mediaElement.dispatchEvent(event);
				return;
			}

			// turn on the renderer (this checks for the existing renderer already)
			mediaElement.changeRenderer(renderInfo.rendererName, mediaFiles);

			if (mediaElement.renderer === null) {
				var event = document.createEvent("HTMLEvents");
				event.initEvent('error', false, false);
				event.message = 'Error creating renderer';
				mediaElement.dispatchEvent(event);
			}
		};
	
	mejs.Utils.addProperty(mediaElement, 'src', getSrc, setSrc);
	mediaElement['getSrc'] = getSrc;
	mediaElement['setSrc'] = setSrc;

	// add methods
	var methods = mejs.html5media.methods;
	for (var i=0, il=methods.length; i<il; i++) {

		// wrap in function to retain scope
		(function(methodName) {

			// run the method on the current renderer
			mediaElement[methodName] = function() {
				console.log('[wrapper ' + mediaElement.id + '.' + methodName + '()]', mediaElement.renderer);
				if (mediaElement.renderer != null) {
					return mediaElement.renderer[methodName](arguments);
				} else {
					return null;
				}
			};

		})(methods[i]);
	}

	// IE && iOS
	if (!mediaElement.addEventListener) {

		mediaElement.events = {};

		// start: fake events
		mediaElement.addEventListener = function (eventName, callback, bubble) {
			// create or find the array of callbacks for this eventName
			mediaElement.events[eventName] = mediaElement.events[eventName] || [];

			// push the callback into the stack
			mediaElement.events[eventName].push(callback);
		};
		mediaElement.removeEventListener = function (eventName, callback) {
			// no eventName means remove all listeners
			if (!eventName) {
				mediaElement.events = {};
				return true;
			}

			// see if we have any callbacks for this eventName
			var callbacks = mediaElement.events[eventName];
			if (!callbacks) {
				return true;
			}

			// check for a specific callback
			if (!callback) {
				mediaElement.events[eventName] = [];
				return true;
			}

			// remove the specific callback
			for (var i = 0, il=callbacks.length; i<il; i++) {
				if (callbacks[i] === callback) {
					mediaElement.events[eventName].splice(i, 1);
					return true;
				}
			}
			return false;
		}
		mediaElement.dispatchEvent = function (event) {

			var i,
				args,
				callbacks = mediaElement.events[event.type];

			//console.log('mejs event', event, mediaElement.events);

			if (callbacks) {
				//args = Array.prototype.slice.call(arguments, 1);
				for (i = 0, il=callbacks.length; i<il; i++) {

					//console.log('--event', event.type, callbacks[i]);

					callbacks[i].apply(null, [event]);
				}
			}
		}
	}

	// returns (true|false) whether it found the renderer
	mediaElement.changeRenderer = function(rendererName, mediaFiles) {

		// check for a match on the current renderer
		if (mediaElement.renderer !== null && mediaElement.renderer.name === rendererName) {

			console.log('Already using: ' + rendererName);
			
			mediaElement.renderer.show();
			mediaElement.renderer.setSrc(mediaFiles[0].src);			
			
			return true;
		}

		// if existing renderer is not the right one, then hide it
		if (mediaElement.renderer !== null) {
			
			console.log('Stopping and hiding: ', mediaElement.renderer);
			
			mediaElement.renderer.pause();
			if (mediaElement.renderer.stop) {
				mediaElement.renderer.stop();
			}
			mediaElement.renderer.hide();
		}

		// see if we have the renderer already created
		var newRenderer = mediaElement.renderers[rendererName],
			newRendererType = null;

		if (newRenderer != null) {
			console.log('restoring: ', newRenderer.name);
			
			newRenderer.show();
			newRenderer.setSrc( mediaFiles[0].src );
			
			mediaElement.renderer = newRenderer;
			return true;
		}

		var rendererArray = mediaElement.options.renderers.length > 0 ? mediaElement.options.renderers : mejs.Renderers.order;

		// find the desired renderer in the array of possible ones
		for (var index in rendererArray) {
			
			if (rendererArray[index] === rendererName) {

				// create the renderer
				newRendererType = mejs.Renderers.renderers[mejs.Renderers.order[index]];
				var renderOptions = mejs.Utils.extend({}, mediaElement.options, newRendererType.options);
				newRenderer = new newRendererType.create(mediaElement, renderOptions, mediaFiles);
				newRenderer.name = rendererName;

				//console.log('Switching to: ', newRendererType);

				// store for later
				mediaElement.renderers[newRendererType.name] = newRenderer;
				mediaElement.renderer = newRenderer;
				mediaElement.rendererName = rendererName;
				newRenderer.show();


				return true;
			}
		}

		console.log('-- ERROR finding: ' + rendererName);

		return false;
	}

	mediaElement.setSize = function(width, height) {
		if (mediaElement.renderer != null) {
			mediaElement.renderer.setSize(width, height);
		}
	}

	// find <source> elements
	if (mediaElement.originalNode != null) {
		var mediaFiles = [];

		switch (mediaElement.originalNode.nodeName.toLowerCase()) {

			case 'iframe':
				mediaFiles.push({type:'', src:mediaElement.originalNode.getAttribute('src') });

				break;

			case 'audio':
			case 'video':
				var i, n, src, type;

				// test <source> types to see if they are usable
				for (i = 0; i < mediaElement.originalNode.childNodes.length; i++) {
					n = mediaElement.originalNode.childNodes[i];
					if (n.nodeType == 1 && n.tagName.toLowerCase() == 'source') {
						src = n.getAttribute('src');
						type = mejs.Utils.formatType(src, n.getAttribute('type'));

						mediaFiles.push({type:type, src:src});
					}
				}
				break;
		}

		if (mediaFiles.length > 0) {
			console.log('initializing src', mediaFiles[0].src);

			// set src
			mediaElement.src = mediaFiles;
		}
	}

	// TEMP
	//mediaElement.load();
	
	if (options.success) {		
		options.success(mediaElement, mediaElement.originalNode);		
	}

	return mediaElement;
};

// export
window.MediaElement = mejs.MediaElement;

})(window.mejs || {}, window, document);