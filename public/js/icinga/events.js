/**
 * Icinga.Events
 *
 * Event handlers
 */
(function (Icinga, $) {

    'use strict';

    Icinga.Events = function (icinga) {
        this.icinga = icinga;
    };

    Icinga.Events.prototype = {

        /**
         * Icinga will call our initialize() function once it's ready
         */
        initialize: function () {
            this.applyGlobalDefaults();
            this.applyHandlers($('#layout'));
            this.icinga.ui.prepareContainers();
        },

        // TODO: What's this?
        applyHandlers: function (el) {

            var icinga = this.icinga;

            $('.dashboard > div', el).each(function(idx, el) {
                var url = $(el).attr('data-icinga-url');
                if (typeof url === 'undefined') return;
                icinga.loader.loadUrl(url, $(el)).autorefresh = true;
            });

            // Set first links href in a action table tr as row href:
            $('table.action tr', el).each(function(idx, el) {
                var $a = $('a[href]', el).first();
                if ($a.length) {
                    $(el).attr('href', $a.attr('href'));
                }
            });

            $('.icinga-module', el).each(function(idx, mod) {
                var $mod = $(mod);
                var moduleName = $mod.data('icinga-module');
                if (icinga.hasModule(moduleName)) {
                    var module = icinga.module(moduleName);
                    // NOT YET, the applyOnloadDings: module.applyEventHandlers(mod);
                }
            });

            $('input.autofocus', el).focus();

            $('.inlinepie', el).sparkline('html', {
                type:        'pie',
                sliceColors: ['#44bb77', '#ffaa44', '#ff5566', '#dcd'],
                width:       '2em',
                height:      '2em',
            });
        },

        /**
         * Global default event handlers
         */
        applyGlobalDefaults: function () {
            // We catch resize events
            $(window).on('resize', { self: this.icinga.ui }, this.icinga.ui.onWindowResize);

            // Destroy Icinga, clean up and interrupt pending requests on unload
            $( window ).on('unload', { self: this }, this.onUnload);
            $( window ).on('beforeunload', { self: this }, this.onUnload);

            // We catch scroll events in our containers
            $('.container').on('scroll', icinga.events.onContainerScroll);

            // We want to catch each link click
            $(document).on('click', 'a', { self: this }, this.linkClicked);

            // We treat tr's with a href attribute like links
            $(document).on('click', 'tr[href]', { self: this }, this.linkClicked);

            $(document).on('click', 'button', { self: this }, this.submitForm);

            // We catch all form submit events
            $(document).on('submit', 'form', { self: this }, this.submitForm);

            // We support an 'autosubmit' class on dropdown form elements
            $(document).on('change', 'form select.autosubmit', { self: this }, this.submitForm);

            $(document).on('keyup', '#menu input.search', {self: this}, this.submitForm);

            $(document).on('mouseenter', '.historycolorgrid td', this.historycolorgridHover);
            $(document).on('mouseleave', '.historycolorgrid td', this.historycolorgidUnhover);

            // TBD: a global autocompletion handler
            // $(document).on('keyup', 'form.auto input', this.formChangeDelayed);
            // $(document).on('change', 'form.auto input', this.formChanged);
            // $(document).on('change', 'form.auto select', this.submitForm);
        },

        onUnload: function (event) {
            var icinga = event.data.self.icinga;
            icinga.logger.info('Unloading Icinga');
            icinga.destroy();
        },

        /**
         * A scroll event happened in one of our containers
         */
        onContainerScroll: function (event) {
            // Ugly. And PLEASE, not so often
            icinga.ui.fixControls();
        },

        historycolorgridHover: function () {
            $(this).addClass('hover');
        },

        historycolorgidUnhover: function() {
            $(this).removeClass('hover');
        },

        /**
         *
         */
        submitForm: function (event) {
            var icinga = event.data.self.icinga;
            event.stopPropagation();
            event.preventDefault();

            // .closest is not required unless subelements to trigger this
            var $form = $(event.currentTarget).closest('form');
            var url = $form.attr('action');
            var method = $form.attr('method');

            var data = $form.serializeArray();
            // TODO: Check button
            data.push({ name: 'btn_submit', value: 'yesss' });

            icinga.logger.debug('Submitting form: ' + method + ' ' + url);

            // We should move this to a generic target-finder:
            var $target = null;
            if ($form.closest('[data-base-target]').length) {
                $target = $(
                    '#' + $form.closest('[data-base-target]').data('baseTarget')
                );
            } else if ($form.closest('.container').length) {
                $target = $form.closest('.container');
            } else {
                icinga.logger.error('No form target found, stopping here');
                return false;
            }

            icinga.loader.loadUrl(url, $target, data, method);
            // TODO: Do we really need to return false with stop/preventDefault?
            return false;
        },

        /**
         * Someone clicked a link or tr[href]
         */
        linkClicked: function (event) {
            var icinga = event.data.self.icinga;

            var $a = $(this);
            var href = $a.attr('href');
            var $li;
            var targetId;
            var isMenuLink = $a.closest('#menu').length > 0;

            // TODO: Let remote links pass through. Right now they only work
            //       combined with target="_blank"
            if ($a.attr('target') === '_blank') {
                return true;
            }
            event.stopPropagation();
            event.preventDefault();

            // If link is hash tag...
            if (href === '#') {
                // ...it may be a menu section without a dedicated link.
                // Switch the active menu item:
                if (isMenuLink) {
                    $li = $a.closest('li');
                    $('#menu .active').removeClass('active');
                    $li.addClass('active');
                }

                // Stop here for all hash tags
                return;
            }

            // If everything else fails, our target is the first column...
            var $target = $('#col1');

            // ...but usually we will use our own container...
            var $container = $a.closest('.container');
            if ($container.length) {
                $target = $container;
            }

            // ...the only exception are class="action" tables...
            if ($a.closest('table.action').length) {
                $target = $('#col2');
            }

            // ...and you can of course override the default behaviour...
            if ($a.closest('[data-base-target]').length) {
                targetId = $a.closest('[data-base-target]').data('baseTarget');

                // Simulate _next to prepare migration to dynamic column layout
                if (targetId === '_next') {
                    targetId = 'col2';
                }

                $target = $('#' + targetId);
            }

            // Tree handler
            // TODO: We should move this somewhere else and "register" such
            //       handlers
            if ($a.closest('.tree').length) {
                $li = $a.closest('li');
                if ($li.find('li').length) {
                    if ($li.hasClass('collapsed')) {
                        $li.removeClass('collapsed');
                    } else {
                        $li.addClass('collapsed');
                        $li.find('li').addClass('collapsed');
                    }
                    return false;
                } else {
                    $target = $('#col2');
                }
            }

            // Load link URL
            icinga.loader.loadUrl(href, $target);

            // Menu links should remove all but the first layout column
            if (isMenuLink) {
                icinga.ui.layout1col();
            }

            // Hardcoded layout switch unless columns are dynamic
            if ($target.attr('id') === 'col2') {
                icinga.ui.layout2col();
            }
            return false;
        },

    /*
        hrefIsHashtag: function(href) {
            // WARNING: IE gives full URL :(
            // Also it doesn't support negativ indexes in substr
            return href.substr(href.length - 1, 1) == '#';
        },
    */

        unbindGlobalHandlers: function () {
            $(window).off('resize', this.onWindowResize);
            $(window).off('unload', this.onUnload);
            $(window).off('beforeunload', this.onUnload);
            $(document).off('scroll', '.container', this.onContainerScroll);
            $(document).off('click', 'a', this.linkClicked);
            $(document).off('click', 'tr[href]', this.linkClicked);
            $(document).off('submit', 'form', this.submitForm);
            $(document).off('click', 'button', this.submitForm);
            $(document).off('change', 'form select.autosubmit', this.submitForm);
            $(document).off('mouseenter', '.historycolorgrid td', this.historycolorgridHover);
            $(document).off('mouseenter', '.historycolorgrid td', this.historycolorgidUnhover);
        },

        destroy: function() {
            // This is gonna be hard, clean up the mess
            this.unbindGlobalHandlers();
            this.icinga = null;
        }
    };

}(Icinga, jQuery));
