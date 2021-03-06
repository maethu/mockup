// modal pattern.
//
// Author: Rok Garbas
// Contact: rok@garbas.si
// Version: 1.0
//
// Description:
//
// License:
//
// Copyright (C) 2010 Plone Foundation
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program; if not, write to the Free Software Foundation, Inc., 51
// Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
//


define([
  'jquery',
  'underscore',
  'mockup-patterns-base',
  'mockup-patterns-backdrop',
  'mockup-registry',
  'mockup-router',
  'mockup-utils',
  'jquery.form'
], function($, _, Base, Backdrop, registry, Router, utils) {
  "use strict";

  var Modal = Base.extend({
    name: "modal",
    createModal: null,
    $model: null,
    defaults: {
      width: "",
      height: "",
      margin: function() { return 20; }, // can be int or function that returns an int -- int is a pixel value
      position: "center middle", // format: "<horizontal> <vertical>" -- allowed values: top, bottom, left, right, center, middle
      triggers: [],
      backdrop: "body", // Element to initiate the Backdrop on.
      backdropOptions: {
        zIndex: "1040",
        opacity: "0.8",
        className: "backdrop",
        classActiveName: "backdrop-active",
        closeOnEsc: true,
        closeOnClick: true
      },
      title: null,
      titleSelector: 'h1:first',
      buttons: '.formControls > input[type="submit"]',
      content: '#content',
      automaticallyAddButtonActions: true,
      loadLinksWithinModal: true,
      prependContent: '.portalMessage',
      templateOptions: {
        className: "modal",
        classHeaderName: "modal-header",
        classBodyName: "modal-body",
        classFooterName: "modal-footer",
        classWrapperName: "modal-wrapper",
        classWrapperInnerName: "modal-wrapper-inner",
        classLoadingName: "modal-loading",
        classActiveName: "active",
        classPrependName: "", // String, css class to be applied to the wrapper of the prepended content
        classContentName: '',  // String, class name to be applied to the content of the modal, useful for modal specific styling
        template: '' +
          '<div class="<%= options.className %>">' +
          '  <div class="<%= options.classHeaderName %>">' +
          '    <a class="close">&times;</a>' +
          '    <% if (title) { %><h3><%= title %></h3><% } %>' +
          '  </div>' +
          '  <div class="<%= options.classBodyName %>">' +
          '    <div class="<%= options.classPrependName %>"><%= prepend %></div> ' +
          '    <div class="<%= options.classContentName %>"><%= content %></div>' +
          '  </div>' +
          '  <div class="<%= options.classFooterName %>"> ' +
          '    <%= buttons %> ' +
          '  </div>' +
          '</div>'
      },
      actions: {},
      actionOptions: {
        eventType: 'click',
        target: null,
        ajaxUrl: null, // string, or function($el, options) that returns a string
        modalFunction: null, // String, function name on self to call
        isForm: false,
        timeout: 5000,
        displayInModal: true,
        reloadWindowOnClose: true,
        error: '.portalMessage.error',
        formFieldError: '.field.error',
        loading: '' +
          '<div class="progress progress-striped active">' +
          '  <div class="bar" style="width: 100%;"></div>' +
          '</div>',
        onSuccess: null,
        onError: null,
        onFormError: null,
        onTimeout: null,
        redirectOnResponse: false,
        redirectToUrl: function($action, response, options) {
            var $base = $(/<base.*?(\/>|<\/base>)/im.exec(response)[0]);
          return $base.attr('href');
        }
      },
      routerOptions: {
        id: null,
        pathExp: null
      },
      form: function(actions) {
        var self = this;
        var $modal = self.$modal;

        if (self.options.automaticallyAddButtonActions) {
          actions[self.options.buttons] = {};
        }

        if (self.options.loadLinksWithinModal) {
          actions.a = {};
        }

        $.each(actions, function(action, options) {
          var actionKeys = _.union(_.keys(self.options.actionOptions), ['templateOptions']);
          var actionOptions = $.extend(true, {}, self.options.actionOptions, _.pick(options, actionKeys));
          options.templateOptions = $.extend(true, options.templateOptions, self.options.templateOptions);

          var patternKeys = _.union(_.keys(self.options.actionOptions), ['actions', 'actionOptions']);
          var patternOptions = $.extend(true, _.omit(options, patternKeys), self.options);

          $(action, $('.'+options.templateOptions.classBodyName, $modal)).each(function(action) {
            var $action = $(this);
            $action.on(actionOptions.eventType, function(e) {
              e.stopPropagation();
              e.preventDefault();

              self.showLoading(false);

              // handle event on $action using a function on self
              if (actionOptions.modalFunction !== null) {
                self[actionOptions.modalFunction]();
              // handle event on input/button using jquery.form library
              } else if ($.nodeName($action[0], 'input') || $.nodeName($action[0], 'button') || options.isForm === true) {
                self.options.handleFormAction.apply(self, [$action, actionOptions, patternOptions]);
              // handle event on link with jQuery.ajax
              } else if (options.ajaxUrl !== null || $.nodeName($action[0], 'a')) {
                self.options.handleLinkAction.apply(self, [$action, actionOptions, patternOptions]);
              }

            });
          });
        });
      },
      handleFormAction: function($action, options, patternOptions) {
        var self = this;
        // pass action that was clicked when submiting form
        var extraData = {};
        extraData[$action.attr('name')] = $action.attr('value');

        var $form;

        if ($.nodeName($action[0], 'form')) {
          $form = $action;
        } else {
          $form = $action.parents('form:not(.disableAutoSubmit)');
        }

        var url;
        if (options.ajaxUrl !== null) {
          if (typeof options.ajaxUrl === 'function') {
            url = options.ajaxUrl.apply(self, [$action, options]);
          } else {
            url = options.ajaxUrl;
          }
        } else {
          url = $action.parents('form').attr('action');
        }

        // We want to trigger the form submit event but NOT use the default
        $form.on('submit', function(e){
          e.preventDefault();
        });
        $form.trigger('submit');

        $form.ajaxSubmit({
          timeout: options.timeout,
          data: extraData,
          url: url,
            error: function(xhr, textStatus, errorStatus) {
              if (textStatus === 'timeout' && options.onTimeout) {
                options.onTimeout.apply(self, xhr, errorStatus);
              // on "error", "abort", and "parsererror"
              } else if (options.onError) {
                options.onError(xhr, textStatus, errorStatus);
              } else {
                console.log('error happened do something');
              }
              self.trigger('formActionError', [xhr, textStatus, errorStatus]);
            },
            success: function(response, state, xhr, form) {
              // if error is found (NOTE: check for both the portal errors
              // and the form field-level errors)
              if ($(options.error, response).size() !== 0 ||
                  $(options.formFieldError, response).size() !== 0) {
                if (options.onFormError) {
                  options.onFormError(self, response, state, xhr, form);
                } else {
                  self.redraw(response, patternOptions);
                }
                return;
              }

              if (options.redirectOnResponse === true) {
                if (typeof options.redirectToUrl === 'function') {
                  window.parent.location.href = options.redirectToUrl.apply(self, [$action, response, options]);
                } else {
                  window.parent.location.href = options.redirectToUrl;
                }
              }

              if (options.onSuccess) {
                options.onSuccess(self, response, state, xhr, form);
              }

              if (options.displayInModal === true) {
                self.redraw(response, patternOptions);
              } else {
                $action.trigger('destroy.modal.patterns');
                // also calls hide
                if (options.reloadWindowOnClose) {
                  self.reloadWindow();
                }
              }
              self.trigger('formActionSuccess', [response, state, xhr, form]);
            }
        });
      },
      handleLinkAction: function($action, options, patternOptions) {
        var self = this;
        var url;

        // Figure out URL
        if (options.ajaxUrl) {
          if (typeof options.ajaxUrl === 'function') {
            url = options.ajaxUrl.apply(self, [$action, options]);
          } else {
            url = options.ajaxUrl;
          }
        } else {
          url = $action.attr('href');
        }

        // Non-ajax link (I know it says "ajaxUrl" ...)
        if (options.displayInModal === false) {
          window.parent.location.href = url;
          return;
        }

        // ajax version
        $.ajax({
          url: url,
          error: function(xhr, textStatus, errorStatus) {
            if (textStatus === 'timeout' && options.onTimeout) {
              options.onTimeout(self.$modal, xhr, errorStatus);

            // on "error", "abort", and "parsererror"
            } else if (options.onError) {
              options.onError(xhr, textStatus, errorStatus);
            } else {
              console.log('error happened do something');
            }
            self.$loading.hide();
            self.trigger('linkActionError', [xhr, textStatus, errorStatus]);
          },
          success: function(response, state, xhr) {
            self.redraw(response, patternOptions);
            if (options.onSuccess) {
              options.onSuccess(self, response, state, xhr);
            }
            self.$loading.hide();
            self.trigger('linkActionSuccess', [response, state, xhr]);
          }
        });
      },
      render: function(options) {
        var self = this;

        self.trigger('before-render');

        if (!self.$raw) {
          return;
        }
        var $raw = self.$raw.clone();

        // Object that will be passed to the template
        var tpl_object = {
          title: '',
          prepend: '<div />',
          content: '',
          buttons: '<div class="pat-modal-buttons"></div>',
          options: options.templateOptions
        };

        // setup the Title
        if (options.title === null) {
          var $title = $(options.titleSelector, $raw);
          tpl_object.title = $title.html();
          $(options.titleSelector, $raw).remove();
        } else {
          tpl_object.title = options.title;
        }

        // Grab items to to insert into the prepend area
        if (options.prependContent) {
          tpl_object.prepend = $('<div />').append($(options.prependContent, $raw).clone()).html();
          $(options.prependContent, $raw).remove();
        }

        // Filter out the content if there is a selector provided
        if (options.content) {
          tpl_object.content = $(options.content, $raw).html();
        } else {
          tpl_object.content = $raw.html();
        }

        // Render html
        self.$modal = $(_.template(self.options.templateOptions.template, tpl_object));

        // Setup buttons
        $(options.buttons, self.$modal).each(function() {
          var $button = $(this);
          $button
            .on('click', function(e) {
              e.stopPropagation();
              e.preventDefault();
            })
            .clone()
            .appendTo($('.pat-modal-buttons', self.$modal))
            .off('click').on('click', function(e) {
              e.stopPropagation();
              e.preventDefault();
              $button.trigger('click');
            });
          $button.hide();
        });

        self.trigger('before-events-setup');

        // Wire up events
        $('.modal-header > a.close', self.$modal)
          .off('click')
          .on('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            $(e.target).trigger('destroy.modal.patterns');
          });

        // cleanup html
        $('.row', self.$modal).removeClass('row');

        // form
        if (options.form) {
          options.form.apply(self, [options.actions]);
        }

        self.$modal
          .addClass(self.options.templateOptions.className)
          .on('click', function(e) {
            e.stopPropagation();
            if ($.nodeName(e.target, 'a')) {
              e.preventDefault();

              // TODO: open links inside modal
              // and slide modal body
            }
            self.$modal.trigger('modal-click');
          })
          .on('destroy.modal.patterns', function(e) {
            e.stopPropagation();
            self.hide();
          })
          .on('resize.modal.patterns', function(e) {
            e.stopPropagation();
            e.preventDefault();
            self.positionModal();
          })
          .appendTo(self.$wrapperInner);
        self.$modal.data('pattern-' + self.name, self);

        self.trigger('after-render');
      }
    },
    reloadWindow: function() {
      window.parent.location.reload();
    },
    init: function() {
      var self = this;

      self.backdrop = new Backdrop(
          self.$el.parents(self.options.backdrop),
          self.options.backdropOptions);

      self.$wrapper = $('> .' + self.options.templateOptions.classWrapperName, self.backdrop.$el);
      if (self.$wrapper.size() === 0) {
        var zIndex = self.options.backdropOptions.zIndex !== null ? parseInt(self.options.backdropOptions.zIndex, 10) + 1 : 1041;
        self.$wrapper = $('<div/>')
          .hide()
          .css({
            'z-index': zIndex,
            'overflow-y': 'auto',
            'position': 'fixed',
            'height': '100%',
            'width': '100%',
            'bottom': '0',
            'left': '0',
            'right': '0',
            'top': '0'
          })
          .addClass(self.options.templateOptions.classWrapperName)
          .insertBefore(self.backdrop.$backdrop)
          .on('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            if (self.options.backdropOptions.closeOnClick) {
              self.backdrop.hide();
            }
          });
      }

      // Router
      if (self.options.routerOptions.id !== null) {
        Router.addRoute('modal', self.options.routerOptions.id, function() {
          this.show();
        }, self, self.options.routerOptions.pathExp);
      }

      self.backdrop.on('hidden', function(e) {
        if (self.$modal !== undefined && self.$modal.hasClass(self.options.templateOptions.classActiveName)) {
          self.hide();
        }
      });

      if (self.options.backdropOptions.closeOnEsc === true) {
        $(document).on('keydown', function(e, data) {
          if (self.$el.is('.' + self.options.templateOptions.classActiveName)) {
            if (e.keyCode === 27) {  // ESC key pressed
              self.hide();
            }
          }
        });
      }

      self.$wrapperInner = $('> .' + self.options.templateOptions.classWrapperInnerName, self.$wrapper);
      if (self.$wrapperInner.size() === 0) {
        self.$wrapperInner = $('<div/>')
          .addClass(self.options.classWrapperInnerName)
          .css({
            'position': 'absolute',
            'bottom': '0',
            'left': '0',
            'right': '0',
            'top': '0'
          })
          .appendTo(self.$wrapper);
      }

      self.$loading = $('> .' + self.options.templateOptions.classLoadingName, self.$wrapperInner);
      if (self.$loading.size() === 0) {
        self.$loading = $('<div/>').hide()
          .addClass(self.options.templateOptions.classLoadingName)
          .appendTo(self.$wrapperInner);
      }

      $(window.parent).resize(function() {
        self.positionModal();
      });

      if (self.options.triggers) {
        $.each(self.options.triggers, function(i, item) {
          var e = item.substring(0, item.indexOf(' '));
          var selector = item.substring(item.indexOf(' '), item.length);
          $(selector || self.$el).on(e, function(e) {
            e.stopPropagation();
            e.preventDefault();
            self.show();
          });
        });
      }

      if (self.$el.is('a')) {
        if (self.$el.attr('href')) {
          if (!self.options.target && self.$el.attr('href').substr(0, 1) === '#') {
            self.options.target = self.$el.attr('href');
            self.options.content = '';
          }
          if (!self.options.ajaxUrl && self.$el.attr('href').substr(0, 1) !== '#') {
            self.options.ajaxUrl = self.$el.attr('href');
          }
        }
        self.$el.on('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          self.show();
        });
      }

      self.initModal();
    },
    showLoading: function(closable) {
      var self = this;

      if (closable === undefined) {
        closable = true;
      }

      self.backdrop.closeOnClick = closable;
      self.backdrop.closeOnEsc = closable;
      self.backdrop.init();

      self.$wrapper.parent().css('overflow', 'hidden');
      self.$wrapper.show();
      self.backdrop.show();
      self.$loading.show();
      self.positionLoading();
    },
    createAjaxModal: function() {
      var self = this;
      self.trigger('before-ajax');
      self.showLoading();
      self.ajaxXHR = $.ajax({
          url: self.options.ajaxUrl,
          type: self.options.ajaxType
      }).done(function(response, textStatus, xhr) {
        self.ajaxXHR = undefined;
        self.$loading.hide();
        self.$raw = $('<div />').append($(utils.parseBodyTag(response)));
        self.trigger('after-ajax', self, textStatus, xhr);
        self._show();
      });
    },
    createTargetModal: function() {
      var self = this;
      self.$raw = $(self.options.target).clone();
      self._show();
    },
    createBasicModal: function() {
      var self = this;
      self.$raw = $('<div/>').html(self.$el.clone());
      self._show();
    },
    createHtmlModal: function() {
      var self = this;
      var $el = $(self.options.html);
      self.$raw = $el;
      self._show();
    },
    initModal: function() {
      var self = this;
      if (self.options.ajaxUrl) {
        self.createModal = self.createAjaxModal;
      } else if (self.options.target) {
        self.createModal = self.createTargetModal;
      } else if (self.options.html) {
        self.createModal = self.createHtmlModal;
      } else {
        self.createModal = self.createBasicModal;
      }
    },
    positionLoading: function() {
      var self = this;
      self.$loading.css({
        'margin-left': self.$wrapper.width()/2 - self.$loading.width()/2,
        'margin-top': self.$wrapper.height()/2 - self.$loading.height()/2,
        'position': 'absolute',
        'bottom': '0',
        'left': '0',
        'right': '0',
        'top': '0'
      });
    },
    findPosition: function(horpos, vertpos, margin, modalWidth, modalHeight,
                           wrapperInnerWidth, wrapperInnerHeight) {
      var returnpos = {};
      var absTop, absBottom, absLeft, absRight;
      absRight = absLeft = absTop = absLeft = 'auto';

      // -- HORIZONTAL POSITION -----------------------------------------------
      if(horpos === 'left') {
        absLeft = margin + 'px';
        // if the width of the wrapper is smaller than the modal, and thus the
        // screen is smaller than the modal, force the left to simply be 0
        if(modalWidth > wrapperInnerWidth) {
          absLeft = '0px';
        }
        returnpos.left = absLeft;
      }
      else if(horpos === 'right') {
        absRight =  margin + 'px';
        // if the width of the wrapper is smaller than the modal, and thus the
        // screen is smaller than the modal, force the right to simply be 0
        if(modalWidth > wrapperInnerWidth) {
          absRight = '0px';
        }
        returnpos.right = absRight;
        returnpos.left = 'auto';
      }
      // default, no specified location, is to center
      else {
        absLeft = ((wrapperInnerWidth / 2) - (modalWidth / 2) - margin) + 'px';
        // if the width of the wrapper is smaller than the modal, and thus the
        // screen is smaller than the modal, force the left to simply be 0
        if(modalWidth > wrapperInnerWidth) {
          absLeft = '0px';
        }
        returnpos.left = absLeft;
      }

      // -- VERTICAL POSITION -------------------------------------------------
      if(vertpos === 'top') {
        absTop = margin + 'px';
        // if the height of the wrapper is smaller than the modal, and thus the
        // screen is smaller than the modal, force the top to simply be 0
        if(modalHeight > wrapperInnerHeight) {
          absTop = '0px';
        }
        returnpos.top = absTop;
      }
      else if(vertpos === 'bottom') {
        absBottom = margin + 'px';
        // if the height of the wrapper is smaller than the modal, and thus the
        // screen is smaller than the modal, force the bottom to simply be 0
        if(modalHeight > wrapperInnerHeight) {
          absBottom = '0px';
        }
        returnpos.bottom = absBottom;
        returnpos.top = 'auto';
      }
      else {
        // default case, no specified location, is to center
        absTop = ((wrapperInnerHeight / 2) - (modalHeight / 2) - margin) + 'px';
        // if the height of the wrapper is smaller than the modal, and thus the
        // screen is smaller than the modal, force the top to simply be 0
        if(modalHeight > wrapperInnerHeight) {
          absTop = '0px';
        }
        returnpos.top = absTop;
      }

      return returnpos;
    },
    // re-position modal at any point.
    //
    // Uses:
    //  options.margin
    //  options.width
    //  options.height
    //  options.position
    positionModal: function() {
      var self = this;

      // modal isn't initialized
      if(self.$modal === null || self.$modal === undefined) { return; }

      // clear out any previously set styling
      self.$modal.removeAttr('style');

      // make sure the (inner) wrapper fills it's container
      //self.$wrapperInner.css({height:'100%', width:'100%'});

      // if backdrop wrapper is set on body, then wrapper should have height of
      // the window, so we can do scrolling of inner wrapper
      if(self.$wrapper.parent().is('body')) {
        self.$wrapper.height($(window.parent).height());
      }

      var margin = typeof self.options.margin === 'function' ? self.options.margin() : self.options.margin;
      self.$modal.css({
        'padding': '0',
        'margin': margin,
        'width': self.options.width, // defaults to "", which doesn't override other css
        'height': self.options.height, // defaults to "", which doesn't override other css
        'position': 'absolute'
      });

      var posopt = self.options.position.split(' '),
          horpos = posopt[0],
          vertpos = posopt[1];
      var modalWidth = self.$modal.outerWidth(true);
      var modalHeight = self.$modal.outerHeight(true);
      var wrapperInnerWidth = self.$wrapperInner.width();
      var wrapperInnerHeight = self.$wrapperInner.height();

      var pos = self.findPosition(horpos, vertpos, margin, modalWidth, modalHeight,
                                  wrapperInnerWidth, wrapperInnerHeight);
      for(var key in pos) {
        self.$modal.css(key, pos[key]);
      }
    },
    render: function(options) {
      var self = this;
      self.trigger('render');
      self.options.render.apply(self, [options]);
      self.trigger('rendered');
    },
    show: function() {
      var self = this;
      self.createModal();
    },
    _show: function() {
      var self = this;
      self.render.apply(self,
          [self.options]);
      self.trigger('show');
      self.backdrop.show();
      self.$wrapper.show();
      self.$loading.hide();
      self.$wrapper.parent().css('overflow', 'hidden');
      self.$el.addClass(self.options.templateOptions.classActiveName);
      self.$modal.addClass(self.options.templateOptions.classActiveName);
      registry.scan(self.$modal);
      self.positionModal();
      $('img', self.$modal).load(function() {
        self.positionModal();
      });
      $(window.parent).on('resize.modal.patterns', function() {
        self.positionModal();
      });
      self.trigger('shown');
    },
    hide: function() {
      var self = this;
      if (self.ajaxXHR) {
        self.ajaxXHR.abort();
      }
      self.trigger('hide');
      if ($('.modal', self.$wrapper).size() < 2) {
        self.backdrop.hide();
        self.$wrapper.hide();
        self.$wrapper.parent().css('overflow', 'visible');
      }
      self.$loading.hide();
      self.$el.removeClass(self.options.templateOptions.classActiveName);
      if (self.$modal !== undefined) {
        self.$modal.remove();
        self.initModal();
      }
      $(window.parent).off('resize.modal.patterns');
      self.trigger('hidden');
    },
    redraw: function(response, options) {
      var self = this;
      self.trigger('beforeDraw');
      self.$modal.remove();
      self.$raw = $('<div />').append($(utils.parseBodyTag(response)));
      self.render.apply(self, [options]);
      self.positionModal();
      registry.scan(self.$modal);
      self.trigger('afterDraw');
    }
  });

  return Modal;

});
