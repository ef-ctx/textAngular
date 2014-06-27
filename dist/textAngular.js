/**
 * @license AngularJS v1.3.0-build.2711+sha.facd904
 * (c) 2010-2014 Google, Inc. http://angularjs.org
 * License: MIT
 */
(function(window, angular, undefined) {'use strict';

var $sanitizeMinErr = angular.$$minErr('$sanitize');

/**
 * @ngdoc module
 * @name ngSanitize
 * @description
 *
 * # ngSanitize
 *
 * The `ngSanitize` module provides functionality to sanitize HTML.
 *
 *
 * <div doc-module-components="ngSanitize"></div>
 *
 * See {@link ngSanitize.$sanitize `$sanitize`} for usage.
 */

/*
 * HTML Parser By Misko Hevery (misko@hevery.com)
 * based on:  HTML Parser By John Resig (ejohn.org)
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 *
 * // Use like so:
 * htmlParser(htmlString, {
 *     start: function(tag, attrs, unary) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * });
 *
 */


/**
 * @ngdoc service
 * @name $sanitize
 * @function
 *
 * @description
 *   The input is sanitized by parsing the html into tokens. All safe tokens (from a whitelist) are
 *   then serialized back to properly escaped html string. This means that no unsafe input can make
 *   it into the returned string, however, since our parser is more strict than a typical browser
 *   parser, it's possible that some obscure input, which would be recognized as valid HTML by a
 *   browser, won't make it through the sanitizer.
 *   The whitelist is configured using the functions `aHrefSanitizationWhitelist` and
 *   `imgSrcSanitizationWhitelist` of {@link ng.$compileProvider `$compileProvider`}.
 *
 * @param {string} html Html input.
 * @returns {string} Sanitized html.
 *
 * @example
   <example module="ngSanitize" deps="angular-sanitize.js">
   <file name="index.html">
     <script>
       function Ctrl($scope, $sce) {
         $scope.snippet =
           '<p style="color:blue">an html\n' +
           '<em onmouseover="this.textContent=\'PWN3D!\'">click here</em>\n' +
           'snippet</p>';
         $scope.deliberatelyTrustDangerousSnippet = function() {
           return $sce.trustAsHtml($scope.snippet);
         };
       }
     </script>
     <div ng-controller="Ctrl">
        Snippet: <textarea ng-model="snippet" cols="60" rows="3"></textarea>
       <table>
         <tr>
           <td>Directive</td>
           <td>How</td>
           <td>Source</td>
           <td>Rendered</td>
         </tr>
         <tr id="bind-html-with-sanitize">
           <td>ng-bind-html</td>
           <td>Automatically uses $sanitize</td>
           <td><pre>&lt;div ng-bind-html="snippet"&gt;<br/>&lt;/div&gt;</pre></td>
           <td><div ng-bind-html="snippet"></div></td>
         </tr>
         <tr id="bind-html-with-trust">
           <td>ng-bind-html</td>
           <td>Bypass $sanitize by explicitly trusting the dangerous value</td>
           <td>
           <pre>&lt;div ng-bind-html="deliberatelyTrustDangerousSnippet()"&gt;
&lt;/div&gt;</pre>
           </td>
           <td><div ng-bind-html="deliberatelyTrustDangerousSnippet()"></div></td>
         </tr>
         <tr id="bind-default">
           <td>ng-bind</td>
           <td>Automatically escapes</td>
           <td><pre>&lt;div ng-bind="snippet"&gt;<br/>&lt;/div&gt;</pre></td>
           <td><div ng-bind="snippet"></div></td>
         </tr>
       </table>
       </div>
   </file>
   <file name="protractor.js" type="protractor">
     it('should sanitize the html snippet by default', function() {
       expect(element(by.css('#bind-html-with-sanitize div')).getInnerHtml()).
         toBe('<p>an html\n<em>click here</em>\nsnippet</p>');
     });

     it('should inline raw snippet if bound to a trusted value', function() {
       expect(element(by.css('#bind-html-with-trust div')).getInnerHtml()).
         toBe("<p style=\"color:blue\">an html\n" +
              "<em onmouseover=\"this.textContent='PWN3D!'\">click here</em>\n" +
              "snippet</p>");
     });

     it('should escape snippet without any filter', function() {
       expect(element(by.css('#bind-default div')).getInnerHtml()).
         toBe("&lt;p style=\"color:blue\"&gt;an html\n" +
              "&lt;em onmouseover=\"this.textContent='PWN3D!'\"&gt;click here&lt;/em&gt;\n" +
              "snippet&lt;/p&gt;");
     });

     it('should update', function() {
       element(by.model('snippet')).clear();
       element(by.model('snippet')).sendKeys('new <b onclick="alert(1)">text</b>');
       expect(element(by.css('#bind-html-with-sanitize div')).getInnerHtml()).
         toBe('new <b>text</b>');
       expect(element(by.css('#bind-html-with-trust div')).getInnerHtml()).toBe(
         'new <b onclick="alert(1)">text</b>');
       expect(element(by.css('#bind-default div')).getInnerHtml()).toBe(
         "new &lt;b onclick=\"alert(1)\"&gt;text&lt;/b&gt;");
     });
   </file>
   </example>
 */
function $SanitizeProvider() {
  this.$get = ['$$sanitizeUri', function($$sanitizeUri) {
    return function(html) {
      var buf = [];
      htmlParser(html, htmlSanitizeWriter(buf, function(uri, isImage) {
        return !/^unsafe/.test($$sanitizeUri(uri, isImage));
      }));
      return buf.join('');
    };
  }];
}

function sanitizeText(chars) {
  var buf = [];
  var writer = htmlSanitizeWriter(buf, angular.noop);
  writer.chars(chars);
  return buf.join('');
}


// Regular Expressions for parsing tags and attributes
var START_TAG_REGEXP =
       /^<\s*([\w:-]+)((?:\s+[\w:-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)\s*>/,
  END_TAG_REGEXP = /^<\s*\/\s*([\w:-]+)[^>]*>/,
  ATTR_REGEXP = /([\w:-]+)(?:\s*=\s*(?:(?:"((?:[^"])*)")|(?:'((?:[^'])*)')|([^>\s]+)))?/g,
  BEGIN_TAG_REGEXP = /^</,
  BEGING_END_TAGE_REGEXP = /^<\s*\//,
  COMMENT_REGEXP = /<!--(.*?)-->/g,
  DOCTYPE_REGEXP = /<!DOCTYPE([^>]*?)>/i,
  CDATA_REGEXP = /<!\[CDATA\[(.*?)]]>/g,
  SURROGATE_PAIR_REGEXP = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
  // Match everything outside of normal chars and " (quote character)
  NON_ALPHANUMERIC_REGEXP = /([^\#-~| |!])/g;


// Good source of info about elements and attributes
// http://dev.w3.org/html5/spec/Overview.html#semantics
// http://simon.html5.org/html-elements

// Safe Void Elements - HTML5
// http://dev.w3.org/html5/spec/Overview.html#void-elements
var voidElements = makeMap("area,br,col,hr,img,wbr");

// Elements that you can, intentionally, leave open (and which close themselves)
// http://dev.w3.org/html5/spec/Overview.html#optional-tags
var optionalEndTagBlockElements = makeMap("colgroup,dd,dt,li,p,tbody,td,tfoot,th,thead,tr"),
    optionalEndTagInlineElements = makeMap("rp,rt"),
    optionalEndTagElements = angular.extend({},
                                            optionalEndTagInlineElements,
                                            optionalEndTagBlockElements);

// Safe Block Elements - HTML5
var blockElements = angular.extend({}, optionalEndTagBlockElements, makeMap("address,article," +
        "aside,blockquote,caption,center,del,dir,div,dl,figure,figcaption,footer,h1,h2,h3,h4,h5," +
        "h6,header,hgroup,hr,ins,map,menu,nav,ol,pre,script,section,table,ul"));

// Inline Elements - HTML5
var inlineElements = angular.extend({}, optionalEndTagInlineElements, makeMap("a,abbr,acronym,b," +
        "bdi,bdo,big,br,cite,code,del,dfn,em,font,i,img,ins,kbd,label,map,mark,q,ruby,rp,rt,s," +
        "samp,small,span,strike,strong,sub,sup,time,tt,u,var"));


// Special Elements (can contain anything)
var specialElements = makeMap("script,style");

var validElements = angular.extend({},
                                   voidElements,
                                   blockElements,
                                   inlineElements,
                                   optionalEndTagElements);

//Attributes that have href and hence need to be sanitized
var uriAttrs = makeMap("background,cite,href,longdesc,src,usemap");
var validAttrs = angular.extend({}, uriAttrs, makeMap(
    'abbr,align,alt,axis,bgcolor,border,cellpadding,cellspacing,class,clear,'+
    'color,cols,colspan,compact,coords,dir,face,headers,height,hreflang,hspace,'+
    'ismap,lang,language,nohref,nowrap,rel,rev,rows,rowspan,rules,'+
    'scope,scrolling,shape,size,span,start,summary,target,title,type,'+
    'valign,value,vspace,width'));

function makeMap(str) {
  var obj = {}, items = str.split(','), i;
  for (i = 0; i < items.length; i++) obj[items[i]] = true;
  return obj;
}


/**
 * @example
 * htmlParser(htmlString, {
 *     start: function(tag, attrs, unary) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * });
 *
 * @param {string} html string
 * @param {object} handler
 */
function htmlParser( html, handler ) {
  var index, chars, match, stack = [], last = html;
  stack.last = function() { return stack[ stack.length - 1 ]; };

  while ( html ) {
    chars = true;

    // Make sure we're not in a script or style element
    if ( !stack.last() || !specialElements[ stack.last() ] ) {

      // Comment
      if ( html.indexOf("<!--") === 0 ) {
        // comments containing -- are not allowed unless they terminate the comment
        index = html.indexOf("--", 4);

        if ( index >= 0 && html.lastIndexOf("-->", index) === index) {
          if (handler.comment) handler.comment( html.substring( 4, index ) );
          html = html.substring( index + 3 );
          chars = false;
        }
      // DOCTYPE
      } else if ( DOCTYPE_REGEXP.test(html) ) {
        match = html.match( DOCTYPE_REGEXP );

        if ( match ) {
          html = html.replace( match[0], '');
          chars = false;
        }
      // end tag
      } else if ( BEGING_END_TAGE_REGEXP.test(html) ) {
        match = html.match( END_TAG_REGEXP );

        if ( match ) {
          html = html.substring( match[0].length );
          match[0].replace( END_TAG_REGEXP, parseEndTag );
          chars = false;
        }

      // start tag
      } else if ( BEGIN_TAG_REGEXP.test(html) ) {
        match = html.match( START_TAG_REGEXP );

        if ( match ) {
          html = html.substring( match[0].length );
          match[0].replace( START_TAG_REGEXP, parseStartTag );
          chars = false;
        }
      }

      if ( chars ) {
        index = html.indexOf("<");

        var text = index < 0 ? html : html.substring( 0, index );
        html = index < 0 ? "" : html.substring( index );

        if (handler.chars) handler.chars( decodeEntities(text) );
      }

    } else {
      html = html.replace(new RegExp("(.*)<\\s*\\/\\s*" + stack.last() + "[^>]*>", 'i'),
        function(all, text){
          text = text.replace(COMMENT_REGEXP, "$1").replace(CDATA_REGEXP, "$1");

          if (handler.chars) handler.chars( decodeEntities(text) );

          return "";
      });

      parseEndTag( "", stack.last() );
    }

    if ( html == last ) {
      throw $sanitizeMinErr('badparse', "The sanitizer was unable to parse the following block " +
                                        "of html: {0}", html);
    }
    last = html;
  }

  // Clean up any remaining tags
  parseEndTag();

  function parseStartTag( tag, tagName, rest, unary ) {
    tagName = angular.lowercase(tagName);
    if ( blockElements[ tagName ] ) {
      while ( stack.last() && inlineElements[ stack.last() ] ) {
        parseEndTag( "", stack.last() );
      }
    }

    if ( optionalEndTagElements[ tagName ] && stack.last() == tagName ) {
      parseEndTag( "", tagName );
    }

    unary = voidElements[ tagName ] || !!unary;

    if ( !unary )
      stack.push( tagName );

    var attrs = {};

    rest.replace(ATTR_REGEXP,
      function(match, name, doubleQuotedValue, singleQuotedValue, unquotedValue) {
        var value = doubleQuotedValue
          || singleQuotedValue
          || unquotedValue
          || '';

        attrs[name] = decodeEntities(value);
    });
    if (handler.start) handler.start( tagName, attrs, unary );
  }

  function parseEndTag( tag, tagName ) {
    var pos = 0, i;
    tagName = angular.lowercase(tagName);
    if ( tagName )
      // Find the closest opened tag of the same type
      for ( pos = stack.length - 1; pos >= 0; pos-- )
        if ( stack[ pos ] == tagName )
          break;

    if ( pos >= 0 ) {
      // Close all the open elements, up the stack
      for ( i = stack.length - 1; i >= pos; i-- )
        if (handler.end) handler.end( stack[ i ] );

      // Remove the open elements from the stack
      stack.length = pos;
    }
  }
}

var hiddenPre=document.createElement("pre");
var spaceRe = /^(\s*)([\s\S]*?)(\s*)$/;
/**
 * decodes all entities into regular string
 * @param value
 * @returns {string} A string with decoded entities.
 */
function decodeEntities(value) {
  if (!value) { return ''; }

  // Note: IE8 does not preserve spaces at the start/end of innerHTML
  // so we must capture them and reattach them afterward
  var parts = spaceRe.exec(value);
  var spaceBefore = parts[1];
  var spaceAfter = parts[3];
  var content = parts[2];
  if (content) {
    hiddenPre.innerHTML=content.replace(/</g,"&lt;");
    // innerText depends on styling as it doesn't display hidden elements.
    // Therefore, it's better to use textContent not to cause unnecessary
    // reflows. However, IE<9 don't support textContent so the innerText
    // fallback is necessary.
    content = 'textContent' in hiddenPre ?
      hiddenPre.textContent : hiddenPre.innerText;
  }
  return spaceBefore + content + spaceAfter;
}

/**
 * Escapes all potentially dangerous characters, so that the
 * resulting string can be safely inserted into attribute or
 * element text.
 * @param value
 * @returns {string} escaped text
 */
function encodeEntities(value) {
  return value.
    replace(/&/g, '&amp;').
    replace(SURROGATE_PAIR_REGEXP, function (value) {
      var hi = value.charCodeAt(0);
      var low = value.charCodeAt(1);
      return '&#' + (((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000) + ';';
    }).
    replace(NON_ALPHANUMERIC_REGEXP, function(value){
      // unsafe chars are: \u0000-\u001f \u007f-\u009f \u00ad \u0600-\u0604 \u070f \u17b4 \u17b5 \u200c-\u200f \u2028-\u202f \u2060-\u206f \ufeff \ufff0-\uffff from jslint.com/lint.html
      // decimal values are: 0-31, 127-159, 173, 1536-1540, 1807, 6068, 6069, 8204-8207, 8232-8239, 8288-8303, 65279, 65520-65535
      var c = value.charCodeAt(0);
      // if unsafe character encode
      if(c <= 159 ||
        c == 173 ||
        (c >= 1536 && c <= 1540) ||
        c == 1807 ||
        c == 6068 ||
        c == 6069 ||
        (c >= 8204 && c <= 8207) ||
        (c >= 8232 && c <= 8239) ||
        (c >= 8288 && c <= 8303) ||
        c == 65279 ||
        (c >= 65520 && c <= 65535)) return '&#' + c + ';';
      return value; // avoids multilingual issues
    }).
    replace(/</g, '&lt;').
    replace(/>/g, '&gt;');
}

var trim = (function() {
  // native trim is way faster: http://jsperf.com/angular-trim-test
  // but IE doesn't have it... :-(
  // TODO: we should move this into IE/ES5 polyfill
  if (!String.prototype.trim) {
    return function(value) {
      return angular.isString(value) ? value.replace(/^\s\s*/, '').replace(/\s\s*$/, '') : value;
    };
  }
  return function(value) {
    return angular.isString(value) ? value.trim() : value;
  };
})();

// Custom logic for accepting certain style options only - textAngular
// Currently allows only the color attribute, all other attributes should be easily done through classes.
function validStyles(styleAttr){
	var result = '';
	var styleArray = styleAttr.split(';');
	angular.forEach(styleArray, function(value){
		var v = value.split(':');
		if(v.length == 2){
			var key = trim(angular.lowercase(v[0]));
			var value = trim(angular.lowercase(v[1]));
			if(
				key === 'color' && (
					value.match(/^rgb\([0-9%,\. ]*\)$/i)
					|| value.match(/^rgba\([0-9%,\. ]*\)$/i)
					|| value.match(/^hsl\([0-9%,\. ]*\)$/i)
					|| value.match(/^hsla\([0-9%,\. ]*\)$/i)
					|| value.match(/^#[0-9a-f]{3,6}$/i)
					|| value.match(/^[a-z]*$/i)
				)
			||
				key === 'text-align' && (
					value === 'left'
					|| value === 'right'
					|| value === 'center'
					|| value === 'justify'
				)
			||
				key === 'float' && (
					value === 'left'
					|| value === 'right'
					|| value === 'none'
				)
			||
				(key === 'width' || key === 'height') && (
					value.match(/[0-9\.]*(px|em|rem|%)/)
				)
			) result += key + ': ' + value + ';';
		}
	});
	return result;
}

// this function is used to manually allow specific attributes on specific tags with certain prerequisites
function validCustomTag(tag, attrs, lkey, value){
	// catch the div placeholder for the iframe replacement
    if (tag === 'img' && attrs['ta-insert-video']){
        if(lkey === 'ta-insert-video' || lkey === 'allowfullscreen' || lkey === 'frameborder' || (lkey === 'contenteditble' && value === 'false')) return true;
    }
    return false;
}

/**
 * create an HTML/XML writer which writes to buffer
 * @param {Array} buf use buf.jain('') to get out sanitized html string
 * @returns {object} in the form of {
 *     start: function(tag, attrs, unary) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * }
 */
function htmlSanitizeWriter(buf, uriValidator){
  var ignore = false;
  var out = angular.bind(buf, buf.push);
  return {
    start: function(tag, attrs, unary){
      tag = angular.lowercase(tag);
      if (!ignore && specialElements[tag]) {
        ignore = tag;
      }
      if (!ignore && validElements[tag] === true) {
        out('<');
        out(tag);
        angular.forEach(attrs, function(value, key){
          var lkey=angular.lowercase(key);
          var isImage=(tag === 'img' && lkey === 'src') || (lkey === 'background');
          if ((lkey === 'style' && (value = validStyles(value)) !== '') || validCustomTag(tag, attrs, lkey, value) || validAttrs[lkey] === true &&
            (uriAttrs[lkey] !== true || uriValidator(value, isImage))) {
            out(' ');
            out(key);
            out('="');
            out(encodeEntities(value));
            out('"');
          }
        });
        out(unary ? '/>' : '>');
      }
    },
    end: function(tag){
        tag = angular.lowercase(tag);
        if (!ignore && validElements[tag] === true) {
          out('</');
          out(tag);
          out('>');
        }
        if (tag == ignore) {
          ignore = false;
        }
      },
    chars: function(chars){
        if (!ignore) {
          out(encodeEntities(chars));
        }
      }
  };
}


// define ngSanitize module and register $sanitize service
angular.module('ngSanitize', []).provider('$sanitize', $SanitizeProvider);

/* global sanitizeText: false */

/**
 * @ngdoc filter
 * @name linky
 * @function
 *
 * @description
 * Finds links in text input and turns them into html links. Supports http/https/ftp/mailto and
 * plain email address links.
 *
 * Requires the {@link ngSanitize `ngSanitize`} module to be installed.
 *
 * @param {string} text Input text.
 * @param {string} target Window (_blank|_self|_parent|_top) or named frame to open links in.
 * @returns {string} Html-linkified text.
 *
 * @usage
   <span ng-bind-html="linky_expression | linky"></span>
 *
 * @example
   <example module="ngSanitize" deps="angular-sanitize.js">
     <file name="index.html">
       <script>
         function Ctrl($scope) {
           $scope.snippet =
             'Pretty text with some links:\n'+
             'http://angularjs.org/,\n'+
             'mailto:us@somewhere.org,\n'+
             'another@somewhere.org,\n'+
             'and one more: ftp://127.0.0.1/.';
           $scope.snippetWithTarget = 'http://angularjs.org/';
         }
       </script>
       <div ng-controller="Ctrl">
       Snippet: <textarea ng-model="snippet" cols="60" rows="3"></textarea>
       <table>
         <tr>
           <td>Filter</td>
           <td>Source</td>
           <td>Rendered</td>
         </tr>
         <tr id="linky-filter">
           <td>linky filter</td>
           <td>
             <pre>&lt;div ng-bind-html="snippet | linky"&gt;<br>&lt;/div&gt;</pre>
           </td>
           <td>
             <div ng-bind-html="snippet | linky"></div>
           </td>
         </tr>
         <tr id="linky-target">
          <td>linky target</td>
          <td>
            <pre>&lt;div ng-bind-html="snippetWithTarget | linky:'_blank'"&gt;<br>&lt;/div&gt;</pre>
          </td>
          <td>
            <div ng-bind-html="snippetWithTarget | linky:'_blank'"></div>
          </td>
         </tr>
         <tr id="escaped-html">
           <td>no filter</td>
           <td><pre>&lt;div ng-bind="snippet"&gt;<br>&lt;/div&gt;</pre></td>
           <td><div ng-bind="snippet"></div></td>
         </tr>
       </table>
     </file>
     <file name="protractor.js" type="protractor">
       it('should linkify the snippet with urls', function() {
         expect(element(by.id('linky-filter')).element(by.binding('snippet | linky')).getText()).
             toBe('Pretty text with some links: http://angularjs.org/, us@somewhere.org, ' +
                  'another@somewhere.org, and one more: ftp://127.0.0.1/.');
         expect(element.all(by.css('#linky-filter a')).count()).toEqual(4);
       });

       it('should not linkify snippet without the linky filter', function() {
         expect(element(by.id('escaped-html')).element(by.binding('snippet')).getText()).
             toBe('Pretty text with some links: http://angularjs.org/, mailto:us@somewhere.org, ' +
                  'another@somewhere.org, and one more: ftp://127.0.0.1/.');
         expect(element.all(by.css('#escaped-html a')).count()).toEqual(0);
       });

       it('should update', function() {
         element(by.model('snippet')).clear();
         element(by.model('snippet')).sendKeys('new http://link.');
         expect(element(by.id('linky-filter')).element(by.binding('snippet | linky')).getText()).
             toBe('new http://link.');
         expect(element.all(by.css('#linky-filter a')).count()).toEqual(1);
         expect(element(by.id('escaped-html')).element(by.binding('snippet')).getText())
             .toBe('new http://link.');
       });

       it('should work with the target property', function() {
        expect(element(by.id('linky-target')).
            element(by.binding("snippetWithTarget | linky:'_blank'")).getText()).
            toBe('http://angularjs.org/');
        expect(element(by.css('#linky-target a')).getAttribute('target')).toEqual('_blank');
       });
     </file>
   </example>
 */
angular.module('ngSanitize').filter('linky', ['$sanitize', function($sanitize) {
  var LINKY_URL_REGEXP =
        /((ftp|https?):\/\/|(mailto:)?[A-Za-z0-9._%+-]+@)\S*[^\s.;,(){}<>]/,
      MAILTO_REGEXP = /^mailto:/;

  return function(text, target) {
    if (!text) return text;
    var match;
    var raw = text;
    var html = [];
    var url;
    var i;
    while ((match = raw.match(LINKY_URL_REGEXP))) {
      // We can not end in these as they are sometimes found at the end of the sentence
      url = match[0];
      // if we did not match ftp/http/mailto then assume mailto
      if (match[2] == match[3]) url = 'mailto:' + url;
      i = match.index;
      addText(raw.substr(0, i));
      addLink(url, match[0].replace(MAILTO_REGEXP, ''));
      raw = raw.substring(i + match[0].length);
    }
    addText(raw);
    return $sanitize(html.join(''));

    function addText(text) {
      if (!text) {
        return;
      }
      html.push(sanitizeText(text));
    }

    function addLink(url, text) {
      html.push('<a ');
      if (angular.isDefined(target)) {
        html.push('target="');
        html.push(target);
        html.push('" ');
      }
      html.push('href="');
      html.push(url);
      html.push('">');
      addText(text);
      html.push('</a>');
    }
  };
}]);


})(window, window.angular);

/*
textAngular
Author : Austin Anderson
License : 2013 MIT
Version 1.2.1

See README.md or https://github.com/fraywing/textAngular/wiki for requirements and use.
*/

(function(){ // encapsulate all variables so they don't become global vars
	"Use Strict";
	
	// fix a webkit bug, see: https://gist.github.com/shimondoodkin/1081133
	// this is set true when a blur occurs as the blur of the ta-bind triggers before the click
	var globalContentEditableBlur = false;
	/* istanbul ignore next: Browser Un-Focus fix for webkit */
	if(/AppleWebKit\/([\d.]+)/.exec(navigator.userAgent)) { // detect webkit
		document.addEventListener("click", function(){
			var curelement = window.event.target;
			if(globalContentEditableBlur && curelement !== null){
				var isEditable = false;
				var tempEl = curelement;
				while(tempEl !== null && tempEl.tagName.toLowerCase() !== 'html' && !isEditable){
					isEditable = tempEl.contentEditable === 'true';
					tempEl = tempEl.parentNode;
				}
				if(!isEditable){
					document.getElementById('textAngular-editableFix-010203040506070809').setSelectionRange(0, 0); // set caret focus to an element that handles caret focus correctly.
					curelement.focus(); // focus the wanted element.
				}
			}
			globalContentEditableBlur = false;
		}, false); // add global click handler
		angular.element(document.body).append('<input id="textAngular-editableFix-010203040506070809" style="width:1px;height:1px;border:none;margin:0;padding:0;position:absolute; top: -10000; left: -10000;" unselectable="on" tabIndex="-1">');
	}
	// IE version detection - http://stackoverflow.com/questions/4169160/javascript-ie-detection-why-not-use-simple-conditional-comments
	// We need this as IE sometimes plays funny tricks with the contenteditable.
	// ----------------------------------------------------------
	// If you're not in IE (or IE version is less than 5) then:
	// ie === undefined
	// If you're in IE (>=5) then you can determine which version:
	// ie === 7; // IE7
	// Thus, to detect IE:
	// if (ie) {}
	// And to detect the version:
	// ie === 6 // IE6
	// ie > 7 // IE8, IE9, IE10 ...
	// ie < 9 // Anything less than IE9
	// ----------------------------------------------------------
	/* istanbul ignore next: untestable browser check */
	var ie = (function(){
		var undef,rv = -1; // Return value assumes failure.
		var ua = window.navigator.userAgent;
		var msie = ua.indexOf('MSIE ');
		var trident = ua.indexOf('Trident/');
		
		if (msie > 0) {
			// IE 10 or older => return version number
			rv = parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
		} else if (trident > 0) {
			// IE 11 (or newer) => return version number
			var rvNum = ua.indexOf('rv:');
			rv = parseInt(ua.substring(rvNum + 3, ua.indexOf('.', rvNum)), 10);
		}
		
		return ((rv > -1) ? rv : undef);
	}());
	
	// Thanks to answer in http://stackoverflow.com/questions/2308134/trim-in-javascript-not-working-in-ie
	/* istanbul ignore next: trim shim for older browsers */
	if(typeof String.prototype.trim !== 'function') {
		String.prototype.trim = function() {
			return this.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); 
		};
	}
	
	// tests against the current jqLite/jquery implementation if this can be an element
	function validElementString(string){
		try{
			return angular.element(string).length !== 0;
		}catch(any){
			return false;
		}
	}
	
	/*
		Custom stylesheet for the placeholders rules.
		Credit to: http://davidwalsh.name/add-rules-stylesheets
	*/
	var sheet, addCSSRule, removeCSSRule;
	/* istanbul ignore else: IE <8 test*/
	if(ie > 8 || ie === undefined){
		var topsheet = (function() {
			// Create the <style> tag
			var style = document.createElement("style");
			/* istanbul ignore else : WebKit hack :( */
			if(/AppleWebKit\/([\d.]+)/.exec(navigator.userAgent)) style.appendChild(document.createTextNode(""));
			
			// Add the <style> element to the page, add as first so the styles can be overridden by custom stylesheets
			document.head.insertBefore(style,document.head.firstChild);
			
			return style.sheet;
		})();
		
		// this sheet is used for the placeholders later on.
		sheet = (function() {
			// Create the <style> tag
			var style = document.createElement("style");
			/* istanbul ignore else : WebKit hack :( */
			if(/AppleWebKit\/([\d.]+)/.exec(navigator.userAgent)) style.appendChild(document.createTextNode(""));
			
			// Add the <style> element to the page, add as first so the styles can be overridden by custom stylesheets
			document.head.appendChild(style);
			
			return style.sheet;
		})();
		
		// use as: addCSSRule("header", "float: left");
		addCSSRule = function(selector, rules) {
			_addCSSRule(sheet, selector, rules);
		};
		_addCSSRule = function(sheet, selector, rules){
			var insertIndex;
			/* istanbul ignore else: firefox catch */
			if(sheet.rules) insertIndex = Math.max(sheet.rules.length - 1, 0);
			else if(sheet.cssRules) insertIndex = Math.max(sheet.cssRules.length - 1, 0);
			/* istanbul ignore else: untestable IE option */
			if(sheet.insertRule) {
				sheet.insertRule(selector + "{" + rules + "}", insertIndex);
			}
			else {
				sheet.addRule(selector, rules, insertIndex);
			}
			// return the index of the stylesheet rule
			return insertIndex;
		};
		
		removeCSSRule = function(index){
			_removeCSSRule(sheet, index);
		};
		_removeCSSRule = function(sheet, index){
			/* istanbul ignore else: untestable IE option */
			if(sheet.removeRule){
				sheet.removeRule(index);
			}else{
				sheet.deleteRule(index);
			}
		};
		
		// add generic styling for the editor
		_addCSSRule(topsheet, '.ta-scroll-window.form-control', "height: 300px; overflow: auto; font-family: inherit; font-size: 100%; position: relative; padding: 0;");
		_addCSSRule(topsheet, '.ta-root.focussed .ta-scroll-window.form-control', 'border-color: #66afe9; outline: 0; -webkit-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075), 0 0 8px rgba(102, 175, 233, 0.6);');
		_addCSSRule(topsheet, '.ta-editor.ta-html', "min-height: 300px; height: auto; overflow: auto; font-family: inherit; font-size: 100%;");
		_addCSSRule(topsheet, '.ta-scroll-window .ta-bind', "height: auto; min-height: 300px; padding: 6px 12px;");
		
		// add the styling for the awesomness of the resizer
		_addCSSRule(topsheet, '.ta-root .ta-resizer-handle-overlay', 'z-index: 100; position: absolute; display: none;');
		_addCSSRule(topsheet, '.ta-root .ta-resizer-handle-overlay > .ta-resizer-handle-info', 'position: absolute; bottom: 16px; right: 16px; border: 1px solid black; background-color: #FFF; padding: 0 4px; opacity: 0.7;');
		_addCSSRule(topsheet, '.ta-root .ta-resizer-handle-overlay > .ta-resizer-handle-background', 'position: absolute; bottom: 5px; right: 5px; left: 5px; top: 5px; border: 1px solid black; background-color: rgba(0, 0, 0, 0.2);');
		_addCSSRule(topsheet, '.ta-root .ta-resizer-handle-overlay > .ta-resizer-handle-corner', 'width: 10px; height: 10px; position: absolute;');
		_addCSSRule(topsheet, '.ta-root .ta-resizer-handle-overlay > .ta-resizer-handle-corner-tl', 'top: 0; left: 0; border-left: 1px solid black; border-top: 1px solid black;');
		_addCSSRule(topsheet, '.ta-root .ta-resizer-handle-overlay > .ta-resizer-handle-corner-tr', 'top: 0; right: 0; border-right: 1px solid black; border-top: 1px solid black;');
		_addCSSRule(topsheet, '.ta-root .ta-resizer-handle-overlay > .ta-resizer-handle-corner-bl', 'bottom: 0; left: 0; border-left: 1px solid black; border-bottom: 1px solid black;');
		_addCSSRule(topsheet, '.ta-root .ta-resizer-handle-overlay > .ta-resizer-handle-corner-br', 'bottom: 0; right: 0; border: 1px solid black; cursor: se-resize; background-color: white;');
	}
	
	// recursive function that returns an array of angular.elements that have the passed attribute set on them
	function getByAttribute(element, attribute){
		var resultingElements = [];
		var childNodes = element.children();
		if(childNodes.length){
			angular.forEach(childNodes, function(child){
				resultingElements = resultingElements.concat(getByAttribute(angular.element(child), attribute));
			});
		}
		if(element.attr(attribute) !== undefined) resultingElements.push(element);
		return resultingElements;
	}
	
	// this global var is used to prevent multiple fires of the drop event. Needs to be global to the textAngular file.
	var dropFired = false;
	var textAngular = angular.module("textAngular", ['ngSanitize', 'textAngularSetup']); //This makes ngSanitize required
	
	// setup the global contstant functions for setting up the toolbar

	// all tool definitions
	var taTools = {};
	/*
		A tool definition is an object with the following key/value parameters:
			action: [function(deferred, restoreSelection)]
					a function that is executed on clicking on the button - this will allways be executed using ng-click and will
					overwrite any ng-click value in the display attribute.
					The function is passed a deferred object ($q.defer()), if this is wanted to be used `return false;` from the action and
					manually call `deferred.resolve();` elsewhere to notify the editor that the action has finished.
					restoreSelection is only defined if the rangy library is included and it can be called as `restoreSelection()` to restore the users
					selection in the WYSIWYG editor.
			display: [string]?
					Optional, an HTML element to be displayed as the buton. The `scope` of the button is the tool definition object with some additional functions
					If set this will cause buttontext and iconclass to be ignored
			buttontext: [string]?
					if this is defined it will replace the contents of the element contained in the `display` element
			iconclass: [string]?
					if this is defined an icon (<i>) will be appended to the `display` element with this string as it's class
			activestate: [function(commonElement)]?
					this function is called on every caret movement, if it returns true then the class taOptions.classes.toolbarButtonActive
					will be applied to the `display` element, else the class will be removed
			disabled: [function()]?
					if this function returns true then the tool will have the class taOptions.classes.disabled applied to it, else it will be removed
		Other functions available on the scope are:
			name: [string]
					the name of the tool, this is the first parameter passed into taRegisterTool
			isDisabled: [function()]
					returns true if the tool is disabled, false if it isn't
			displayActiveToolClass: [function(boolean)]
					returns true if the tool is 'active' in the currently focussed toolbar
			onElementSelect: [Object]
					This object contains the following key/value pairs and is used to trigger the ta-element-select event
					element: [String]
						an element name, will only trigger the onElementSelect action if the tagName of the element matches this string
					filter: [function(element)]?
						an optional filter that returns a boolean, if true it will trigger the onElementSelect.
					action: [function(event, element, editorScope)]
						the action that should be executed if the onElementSelect function runs
	*/
	// name and toolDefinition to add into the tools available to be added on the toolbar
	function registerTextAngularTool(name, toolDefinition){
		if(!name || name === '' || taTools.hasOwnProperty(name)) throw('textAngular Error: A unique name is required for a Tool Definition');
		if(
			(toolDefinition.display && (toolDefinition.display === '' || !validElementString(toolDefinition.display))) ||
			(!toolDefinition.display && !toolDefinition.buttontext && !toolDefinition.iconclass)
		)
			throw('textAngular Error: Tool Definition for "' + name + '" does not have a valid display/iconclass/buttontext value');
		taTools[name] = toolDefinition;
	}

	textAngular.constant('taRegisterTool', registerTextAngularTool);
	textAngular.value('taTools', taTools);
	
	textAngular.config([function(){
		// clear taTools variable. Just catches testing and any other time that this config may run multiple times...
		angular.forEach(taTools, function(value, key){ delete taTools[key];	});
	}]);

	textAngular.directive("textAngular", [
		'$compile', '$timeout', 'taOptions', 'taSanitize', 'taSelection', 'taExecCommand', 'textAngularManager', '$window', '$document', '$animate', '$log',
		function($compile, $timeout, taOptions, taSanitize, taSelection, taExecCommand, textAngularManager, $window, $document, $animate, $log){
			return {
				require: '?ngModel',
				scope: {},
				restrict: "EA",
				link: function(scope, element, attrs, ngModel){
					// all these vars should not be accessable outside this directive
					var _keydown, _keyup, _keypress, _mouseup, _focusin, _focusout,
						_originalContents, _toolbars,
						_serial = (attrs.serial) ? attrs.serial : Math.floor(Math.random() * 10000000000000000),
						_name = (attrs.name) ? attrs.name : 'textAngularEditor' + _serial,
						_taExecCommand;
					
					var oneEvent = function(_element, event, action){
						$timeout(function(){
							// shim the .one till fixed
							var _func = function(){
								_element.off(event, _func);
								action();
							};
							_element.on(event, _func);
						}, 100);
					};
					_taExecCommand = taExecCommand(attrs.taDefaultWrap);
					// get the settings from the defaults and add our specific functions that need to be on the scope
					angular.extend(scope, angular.copy(taOptions), {
						// wraps the selection in the provided tag / execCommand function. Should only be called in WYSIWYG mode.
						wrapSelection: function(command, opt, isSelectableElementTool){
							// catch errors like FF erroring when you try to force an undo with nothing done
							_taExecCommand(command, false, opt);
							if(isSelectableElementTool){
								// re-apply the selectable tool events
								scope['reApplyOnSelectorHandlerstaTextElement' + _serial]();
							}
							// refocus on the shown display element, this fixes a display bug when using :focus styles to outline the box.
							// You still have focus on the text/html input it just doesn't show up
							scope.displayElements.text[0].focus();
						},
						showHtml: false
					});
					// setup the options from the optional attributes
					if(attrs.taFocussedClass)			scope.classes.focussed = attrs.taFocussedClass;
					if(attrs.taTextEditorClass)			scope.classes.textEditor = attrs.taTextEditorClass;
					if(attrs.taHtmlEditorClass)			scope.classes.htmlEditor = attrs.taHtmlEditorClass;
					// optional setup functions
					if(attrs.taTextEditorSetup)			scope.setup.textEditorSetup = scope.$parent.$eval(attrs.taTextEditorSetup);
					if(attrs.taHtmlEditorSetup)			scope.setup.htmlEditorSetup = scope.$parent.$eval(attrs.taHtmlEditorSetup);
					// optional fileDropHandler function
					if(attrs.taFileDrop)				scope.fileDropHandler = scope.$parent.$eval(attrs.taFileDrop);
					else								scope.fileDropHandler = scope.defaultFileDropHandler;
					
					_originalContents = element[0].innerHTML;
					// clear the original content
					element[0].innerHTML = '';

					// Setup the HTML elements as variable references for use later
					scope.displayElements = {
						// we still need the hidden input even with a textarea as the textarea may have invalid/old input in it,
						// wheras the input will ALLWAYS have the correct value.
						forminput: angular.element("<input type='hidden' tabindex='-1' style='display: none;'>"),
						html: angular.element("<textarea></textarea>"),
						text: angular.element("<div></div>"),
						// other toolbased elements
						scrollWindow: angular.element("<div class='ta-scroll-window'></div>"),
						popover: angular.element('<div class="popover fade bottom" style="max-width: none; width: 305px;"><div class="arrow"></div></div>'),
						popoverContainer: angular.element('<div class="popover-content"></div>'),
						resize: {
							overlay: angular.element('<div class="ta-resizer-handle-overlay"></div>'),
							background: angular.element('<div class="ta-resizer-handle-background"></div>'),
							anchors: [
								angular.element('<div class="ta-resizer-handle-corner ta-resizer-handle-corner-tl"></div>'),
								angular.element('<div class="ta-resizer-handle-corner ta-resizer-handle-corner-tr"></div>'),
								angular.element('<div class="ta-resizer-handle-corner ta-resizer-handle-corner-bl"></div>'),
								angular.element('<div class="ta-resizer-handle-corner ta-resizer-handle-corner-br"></div>')
							],
							info: angular.element('<div class="ta-resizer-handle-info"></div>')
						}
					};
					
					// Setup the popover
					scope.displayElements.popover.append(scope.displayElements.popoverContainer);
					scope.displayElements.scrollWindow.append(scope.displayElements.popover);
					
					scope.displayElements.popover.on('mousedown', function(e, eventData){
						/* istanbul ignore else: this is for catching the jqLite testing*/
						if(eventData) angular.extend(e, eventData);
						// this prevents focusout from firing on the editor when clicking anything in the popover
						e.preventDefault();
						return false;
					});
					
					// define the popover show and hide functions
					scope.showPopover = function(_el){
						scope.reflowPopover(_el);
						scope.displayElements.popover.css('display', 'block');
						$animate.addClass(scope.displayElements.popover, 'in');
						oneEvent(element, 'click keyup', function(){scope.hidePopover();});
					};
					scope.reflowPopover = function(_el){
						if(scope.displayElements.text[0].offsetHeight - 51 > _el[0].offsetTop){
							scope.displayElements.popover.css('top', _el[0].offsetTop + _el[0].offsetHeight + 'px');
							scope.displayElements.popover.removeClass('top').addClass('bottom');
						}else{
							scope.displayElements.popover.css('top', _el[0].offsetTop - 54 + 'px');
							scope.displayElements.popover.removeClass('bottom').addClass('top');
						}
						scope.displayElements.popover.css('left', Math.max(0,
							Math.min(
								scope.displayElements.text[0].offsetWidth - 305,
								_el[0].offsetLeft + (_el[0].offsetWidth / 2.0) - 152.5
							)
						) + 'px');
					};
					scope.hidePopover = function(){
						$animate.removeClass(scope.displayElements.popover, 'in', /* istanbul ignore next: dosen't test with mocked animate */ function(){
							scope.displayElements.popover.css('display', '');
							scope.displayElements.popoverContainer.attr('style', '');
							scope.displayElements.popoverContainer.attr('class', 'popover-content');
						});
					};
					
					// setup the resize overlay
					scope.displayElements.resize.overlay.append(scope.displayElements.resize.background);
					angular.forEach(scope.displayElements.resize.anchors, function(anchor){ scope.displayElements.resize.overlay.append(anchor);});
					scope.displayElements.resize.overlay.append(scope.displayElements.resize.info);
					scope.displayElements.scrollWindow.append(scope.displayElements.resize.overlay);
					
					// define the show and hide events
					scope.reflowResizeOverlay = function(_el){
						_el = angular.element(_el)[0];
						scope.displayElements.resize.overlay.css({
							'display': 'block',
							'left': _el.offsetLeft - 5 + 'px',
							'top': _el.offsetTop - 5 + 'px',
							'width': _el.offsetWidth + 10 + 'px',
							'height': _el.offsetHeight + 10 + 'px'
						});
						scope.displayElements.resize.info.text(_el.offsetWidth + ' x ' + _el.offsetHeight);
					};
					/* istanbul ignore next: pretty sure phantomjs won't test this */
					scope.showResizeOverlay = function(_el){
						var resizeMouseDown = function(event){
							var startPosition = {
								width: parseInt(_el.attr('width')),
								height: parseInt(_el.attr('height')),
								x: event.clientX,
								y: event.clientY
							};
							if(startPosition.width === undefined) startPosition.width = _el[0].offsetWidth;
							if(startPosition.height === undefined) startPosition.height = _el[0].offsetHeight;
							scope.hidePopover();
							var ratio = startPosition.height / startPosition.width;
							var mousemove = function(event){
								// calculate new size
								var pos = {
									x: Math.max(0, startPosition.width + (event.clientX - startPosition.x)),
									y: Math.max(0, startPosition.height + (event.clientY - startPosition.y))
								};
								var applyImageSafeCSS = function(_el, css){
									_el = angular.element(_el);
									if(_el[0].tagName.toLowerCase() === 'img'){
										if(css.height){
											_el.attr('height', css.height);
											delete css.height;
										}
										if(css.width){
											_el.attr('width', css.width);
											delete css.width;
										}
									}
									_el.css(css);
								};
								if(event.shiftKey){
									// keep ratio
									var newRatio = pos.y / pos.x;
									applyImageSafeCSS(_el, {
										width: ratio > newRatio ? pos.x : pos.y / ratio,
										height: ratio > newRatio ? pos.x * ratio : pos.y
									});
								}else{
									applyImageSafeCSS(_el, {
										width: pos.x,
										height: pos.y
									});
								}
								// reflow the popover tooltip
								scope.reflowResizeOverlay(_el);
							};
							$document.find('body').on('mousemove', mousemove);
							oneEvent(scope.displayElements.resize.overlay, 'mouseup', function(){
								$document.find('body').off('mousemove', mousemove);
								scope.showPopover(_el);
							});
							event.stopPropagation();
							event.preventDefault();
						};
						
						scope.displayElements.resize.anchors[3].on('mousedown', resizeMouseDown);
						
						scope.reflowResizeOverlay(_el);
						oneEvent(element, 'click', function(){scope.hideResizeOverlay();});
					};
					/* istanbul ignore next: pretty sure phantomjs won't test this */
					scope.hideResizeOverlay = function(){
						scope.displayElements.resize.overlay.css('display', '');
					};
					
					// allow for insertion of custom directives on the textarea and div
					scope.setup.htmlEditorSetup(scope.displayElements.html);
					scope.setup.textEditorSetup(scope.displayElements.text);
					scope.displayElements.html.attr({
						'id': 'taHtmlElement' + _serial,
						'ng-show': 'showHtml',
						'ta-bind': 'ta-bind',
						'ng-model': 'html'
					});
					scope.displayElements.text.attr({
						'id': 'taTextElement' + _serial,
						'contentEditable': 'true',
						'ta-bind': 'ta-bind',
						'ng-model': 'html'
					});
					scope.displayElements.scrollWindow.attr({'ng-hide': 'showHtml'});
					if(attrs.taDefaultWrap) scope.displayElements.text.attr('ta-default-wrap', attrs.taDefaultWrap);

					// add the main elements to the origional element
					scope.displayElements.scrollWindow.append(scope.displayElements.text);
					element.append(scope.displayElements.scrollWindow);
					element.append(scope.displayElements.html);

					scope.displayElements.forminput.attr('name', _name);
					element.append(scope.displayElements.forminput);

					if(attrs.tabindex){
						element.removeAttr('tabindex');
						scope.displayElements.text.attr('tabindex', attrs.tabindex);
						scope.displayElements.html.attr('tabindex', attrs.tabindex);
					}

					if (attrs.placeholder) {
						scope.displayElements.text.attr('placeholder', attrs.placeholder);
						scope.displayElements.html.attr('placeholder', attrs.placeholder);
					}

					if(attrs.taDisabled){
						scope.displayElements.text.attr('ta-readonly', 'disabled');
						scope.displayElements.html.attr('ta-readonly', 'disabled');
						scope.disabled = scope.$parent.$eval(attrs.taDisabled);
						scope.$parent.$watch(attrs.taDisabled, function(newVal){
							scope.disabled = newVal;
							if(scope.disabled){
								element.addClass(scope.classes.disabled);
							}else{
								element.removeClass(scope.classes.disabled);
							}
						});
					}

					// compile the scope with the text and html elements only - if we do this with the main element it causes a compile loop
					$compile(scope.displayElements.scrollWindow)(scope);
					$compile(scope.displayElements.html)(scope);
					
					scope.updateTaBindtaTextElement = scope['updateTaBindtaTextElement' + _serial];
					scope.updateTaBindtaHtmlElement = scope['updateTaBindtaHtmlElement' + _serial];
					
					// add the classes manually last
					element.addClass("ta-root");
					scope.displayElements.scrollWindow.addClass("ta-text ta-editor " + scope.classes.textEditor);
					scope.displayElements.html.addClass("ta-html ta-editor " + scope.classes.htmlEditor);

					// used in the toolbar actions
					scope._actionRunning = false;
					var _savedSelection = false;
					scope.startAction = function(){
						scope._actionRunning = true;
						// if rangy library is loaded return a function to reload the current selection
						if($window.rangy && $window.rangy.saveSelection){
							_savedSelection = $window.rangy.saveSelection();
							return function(){
								if(_savedSelection) $window.rangy.restoreSelection(_savedSelection);
							};
						}
					};
					scope.endAction = function(){
						scope._actionRunning = false;
						if(_savedSelection) $window.rangy.removeMarkers(_savedSelection);
						_savedSelection = false;
						scope.updateSelectedStyles();
						// only update if in text or WYSIWYG mode
						if(!scope.showHtml) scope['updateTaBindtaTextElement' + _serial]();
					};

					// note that focusout > focusin is called everytime we click a button - except bad support: http://www.quirksmode.org/dom/events/blurfocus.html
					// cascades to displayElements.text and displayElements.html automatically.
					_focusin = function(){
						element.addClass(scope.classes.focussed);
						_toolbars.focus();
					};
					scope.displayElements.html.on('focus', _focusin);
					scope.displayElements.text.on('focus', _focusin);
					_focusout = function(e){
						// if we are NOT runnig an action and have NOT focussed again on the text etc then fire the blur events
						if(!scope._actionRunning && $document[0].activeElement !== scope.displayElements.html[0] && $document[0].activeElement !== scope.displayElements.text[0]){
							element.removeClass(scope.classes.focussed);
							_toolbars.unfocus();
							// to prevent multiple apply error defer to next seems to work.
							$timeout(function(){ element.triggerHandler('blur'); }, 0);
						}
						e.preventDefault();
						return false;
					};
					scope.displayElements.html.on('blur', _focusout);
					scope.displayElements.text.on('blur', _focusout);

					// Setup the default toolbar tools, this way allows the user to add new tools like plugins.
					// This is on the editor for future proofing if we find a better way to do this.
					scope.queryFormatBlockState = function(command){
						return command.toLowerCase() === $document[0].queryCommandValue('formatBlock').toLowerCase();
					};
					scope.switchView = function(){
						scope.showHtml = !scope.showHtml;
						//Show the HTML view
						if(scope.showHtml){
							//defer until the element is visible
							$timeout(function(){
								// [0] dereferences the DOM object from the angular.element
								return scope.displayElements.html[0].focus();
							}, 100);
						}else{
							//Show the WYSIWYG view
							//defer until the element is visible
							$timeout(function(){
								// [0] dereferences the DOM object from the angular.element
								return scope.displayElements.text[0].focus();
							}, 100);
						}
					};

					// changes to the model variable from outside the html/text inputs
					// if no ngModel, then the only input is from inside text-angular
					if(attrs.ngModel){
						var _firstRun = true;
						ngModel.$render = function(){
							if(_firstRun){
								// we need this firstRun to set the originalContents otherwise it gets overrided by the setting of ngModel to undefined from NaN
								_firstRun = false;
								// if view value is null or undefined initially and there was original content, set to the original content
								var _initialValue = scope.$parent.$eval(attrs.ngModel);
								if((_initialValue === undefined || _initialValue === null) && (_originalContents && _originalContents !== '')){
									// on passing through to taBind it will be sanitised
									ngModel.$setViewValue(_originalContents);
								}
							}
							scope.displayElements.forminput.val(ngModel.$viewValue);
							// if the editors aren't focused they need to be updated, otherwise they are doing the updating
							/* istanbul ignore else: don't care */
							if(!scope._elementSelectTriggered && $document[0].activeElement !== scope.displayElements.html[0] && $document[0].activeElement !== scope.displayElements.text[0]){
								// catch model being null or undefined
								scope.html = ngModel.$viewValue || '';
							}
						};
					}else{
						// if no ngModel then update from the contents of the origional html.
						scope.displayElements.forminput.val(_originalContents);
						scope.html = _originalContents;
					}
					
					// changes from taBind back up to here
					scope.$watch('html', function(newValue, oldValue){
						if(newValue !== oldValue){
							if(attrs.ngModel && ngModel.$viewValue !== newValue) ngModel.$setViewValue(newValue);
							scope.displayElements.forminput.val(newValue);
						}
					});

					if(attrs.taTargetToolbars) _toolbars = textAngularManager.registerEditor(_name, scope, attrs.taTargetToolbars.split(','));
					else{
						var _toolbar = angular.element('<div text-angular-toolbar name="textAngularToolbar' + _serial + '">');
						// passthrough init of toolbar options
						if(attrs.taToolbar)						_toolbar.attr('ta-toolbar', attrs.taToolbar);
						if(attrs.taToolbarClass)				_toolbar.attr('ta-toolbar-class', attrs.taToolbarClass);
						if(attrs.taToolbarGroupClass)			_toolbar.attr('ta-toolbar-group-class', attrs.taToolbarGroupClass);
						if(attrs.taToolbarButtonClass)			_toolbar.attr('ta-toolbar-button-class', attrs.taToolbarButtonClass);
						if(attrs.taToolbarActiveButtonClass)	_toolbar.attr('ta-toolbar-active-button-class', attrs.taToolbarActiveButtonClass);
						if(attrs.taFocussedClass)				_toolbar.attr('ta-focussed-class', attrs.taFocussedClass);

						element.prepend(_toolbar);
						$compile(_toolbar)(scope.$parent);
						_toolbars = textAngularManager.registerEditor(_name, scope, ['textAngularToolbar' + _serial]);
					}

					scope.$on('$destroy', function(){
						textAngularManager.unregisterEditor(_name);
					});
					
					// catch element select event and pass to toolbar tools
					scope.$on('ta-element-select', function(event, element){
						_toolbars.triggerElementSelect(event, element);
					});
					
					scope.$on('ta-drop-event', function(event, element, dropEvent, dataTransfer){
						scope.displayElements.text[0].focus();
						if(dataTransfer && dataTransfer.files && dataTransfer.files.length > 0){
							angular.forEach(dataTransfer.files, function(file){
								// taking advantage of boolean execution, if the fileDropHandler returns true, nothing else after it is executed
								// If it is false then execute the defaultFileDropHandler if the fileDropHandler is NOT the default one
								try{
									return scope.fileDropHandler(file, scope.wrapSelection) ||
										(scope.fileDropHandler !== scope.defaultFileDropHandler &&
										scope.defaultFileDropHandler(file, scope.wrapSelection));
								}catch(error){
									$log.error(error);
								}
							});
							dropEvent.preventDefault();
							dropEvent.stopPropagation();
						}
					});
					
					// the following is for applying the active states to the tools that support it
					scope._bUpdateSelectedStyles = false;
					// loop through all the tools polling their activeState function if it exists
					scope.updateSelectedStyles = function(){
						var _selection;
						// test if the common element ISN'T the root ta-text node
						if((_selection = taSelection.getSelectionElement()) !== undefined && _selection.parentNode !== scope.displayElements.text[0]){
							_toolbars.updateSelectedStyles(angular.element(_selection));
						}else _toolbars.updateSelectedStyles();
						// used to update the active state when a key is held down, ie the left arrow
						if(scope._bUpdateSelectedStyles) $timeout(scope.updateSelectedStyles, 200);
					};
					// start updating on keydown
					_keydown = function(){
						/* istanbul ignore else: don't run if already running */
						if(!scope._bUpdateSelectedStyles){
							scope._bUpdateSelectedStyles = true;
							scope.$apply(function(){
								scope.updateSelectedStyles();
							});
						}
					};
					scope.displayElements.html.on('keydown', _keydown);
					scope.displayElements.text.on('keydown', _keydown);
					// stop updating on key up and update the display/model
					_keyup = function(){
						scope._bUpdateSelectedStyles = false;
					};
					scope.displayElements.html.on('keyup', _keyup);
					scope.displayElements.text.on('keyup', _keyup);
					// stop updating on key up and update the display/model
					_keypress = function(event, eventData){
						/* istanbul ignore else: this is for catching the jqLite testing*/
						if(eventData) angular.extend(event, eventData);
						scope.$apply(function(){
							if(_toolbars.sendKeyCommand(event)){
								/* istanbul ignore else: don't run if already running */
								if(!scope._bUpdateSelectedStyles){
									scope.updateSelectedStyles();
								}
								event.preventDefault();
								return false;
							}
						});
					};
					scope.displayElements.html.on('keypress', _keypress);
					scope.displayElements.text.on('keypress', _keypress);
					// update the toolbar active states when we click somewhere in the text/html boxed
					_mouseup = function(){
						// ensure only one execution of updateSelectedStyles()
						scope._bUpdateSelectedStyles = false;
						scope.$apply(function(){
							scope.updateSelectedStyles();
						});
					};
					scope.displayElements.html.on('mouseup', _mouseup);
					scope.displayElements.text.on('mouseup', _mouseup);
				}
			};
		}
	]).factory('taBrowserTag', [function(){
		return function(tag){
			/* istanbul ignore next: ie specific test */
			if(!tag) return (ie <= 8)? 'P' : 'p';
			else if(tag === '') return (ie === undefined)? 'div' : (ie <= 8)? 'P' : 'p';
			else return (ie <= 8)? tag.toUpperCase() : tag;
		};
	}]).factory('taExecCommand', ['taSelection', 'taBrowserTag', '$document', function(taSelection, taBrowserTag, $document){
		var BLOCKELEMENTS = /(address|article|aside|audio|blockquote|canvas|dd|div|dl|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hgroup|hr|noscript|ol|output|p|pre|section|table|tfoot|ul|video)/ig;
		var LISTELEMENTS = /(ul|li|ol)/ig;
		var listToDefault = function(listElement, defaultWrap){
			var $target;
			// if all selected then we should remove the list
			// grab all li elements and convert to taDefaultWrap tags
			var children = listElement.find('li');
			for(i = children.length - 1; i >= 0; i--){
				$target = angular.element('<' + defaultWrap + '>' + children[i].innerHTML + '</' + defaultWrap + '>');
				listElement.after($target);
			}
			listElement.remove();
			taSelection.setSelectionToElementEnd($target[0]);
		};
		var listToList = function(listElement, newListTag){
			var $target = angular.element('<' + newListTag + '>' + listElement[0].innerHTML + '</' + newListTag + '>');
			listElement.after($target);
			listElement.remove();
			taSelection.setSelectionToElementEnd($target.find('li')[0]);
		};
		var childElementsToList = function(elements, listElement, newListTag){
			var html = '';
			for(i = elements.length - 1; i >= 0; i--){
				html += '<' + taBrowserTag('li') + '>' + elements[i].innerHTML + '</' + taBrowserTag('li') + '>';
			}
			var $target = angular.element('<' + newListTag + '>' + html + '</' + newListTag + '>');
			listElement.after($target);
			listElement.remove();
			taSelection.setSelectionToElementEnd($target.find('li')[0]);
		};










        var wrapInside = function (container, start, end, tagName) {
            console.log("INSIDE -------------------------- ", container.textContent, start, end, "|" + container.textContent.slice(start, end) + "|");
            var subRange, wrapperNode, result, 
                containerTag = (container.tagName) ? container.tagName : container.parentElement.tagName;
            
            if( (start < end) && // void container
                (tagName.toLowerCase() !== containerTag.toLowerCase()) ) {
                wrapperNode = $document[0].createElement(tagName);
                subRange = $document[0].createRange();
                
                subRange.setStart(container, start);
                subRange.setEnd(container, end);
                //subRange.setEnd(container, (end === container.textContent.length) ? end : end );
                
                subRange.surroundContents(wrapperNode);
                subRange.detach();

                result = container.parentElement; // return the surrounding element, the added one
            } else {
                result = container;
            } 
            
            return result;

        };


        var wrapUp = function (range, actCont, tagName, direction) {
            console.log("UP - ", actCont, (actCont) ? actCont.textContent : 'null', (direction) ? '->': '<-');
            
            var start , end, sibling, atTop = (actCont) ? range.commonAncestorContainer.isSameNode(actCont.parentElement) : false;
                
            if (direction){
                start = (!actCont) ? range.startOffset : 0 ;
                actCont = (!actCont) ? range.startContainer : actCont ; 
                end = (atTop) ? range.endOffset : actCont.textContent.length;
            } else {
                end = (!actCont) ? range.endOffset : actCont.textContent.length;
                actCont = (!actCont) ? range.endContainer : actCont ; 
                start = (atTop) ? range.startOffset : 0 ;
            }
            
            actCont = wrapInside(actCont, start, end, tagName);
            sibling = actCont[(direction) ? 'nextSibling' : 'previousSibling'];
            actCont = (sibling) ? sibling : actCont.parentElement;
            
            if (!atTop) {
                wrapUp(range, actCont, tagName, direction);
            }

        };

		// Wraps the selection with a epecified string taggified: tag = mytag > <myTag>selection</myTag>
		var wrapSelectionWithTag = function (customTag) {

			var sel = taSelection.getSelection(),
				range = sel.getRangeAt(0),
				tag, 
				getContainer = function (node) {
                    return (node.nodeType === 3) ? node.parentNode : node; 
                },

                resetRange = function (range, currentNode, previousNode) {
                    var nextNode,
                        commonNode = range.commonAncestorContainer;

                    if(currentNode.isSameNode(commonNode) || (currentNode.nextSibling)) {
                        // check next text node or add one "" if it does not exists and place the end offset at 0 position
                        nextNode = previousNode.nextSibling ;

                        if(nextNode){ 
                            if(nextNode.nodeType === 3){ // the next sibling is a text node so it can contain the end of the range
                                range.setEnd(nextNode, 0);
                            } else {
                                // create a text node there and place end at pos 0 
                                previousNode.insertAdjacentHTML('afterEnd','.');
                                range.setEnd(nextNode, 0);
                                previousNode.parentNode.removeChild(previousNode.nextSibling);
                            }
                        } else {
                            // create a text node there and place end at pos 0 
                            nextNode.parentNode.insertAdjacentHTML('beforeEnd','.');
                            range.setEnd(commonNode.lastChild, 0);
                            nextNode.parentNode.removeChild(nextNode.parentNode.lastChild);
                        }
                    } else {
                        // recursive case 
                        resetRange(range, currentNode.parentNode, currentNode);
                    }

                }
                ; 

			if(!range.collapsed){

				tag = customTag.toLowerCase().replace(/[<>]/ig, '');
				start = getContainer(range.startContainer);
				end = getContainer(range.endContainer);
				common = getContainer(range.commonAncestorContainer);

                // reset start and endpoint of the selection
                
                if(range.endContainer.textContent.length === range.endOffset){
                    resetRange(range, range.endContainer, null);
                }

				if( !common.isSameNode(start) ){
                    wrapUp(range, null, tag, true);                        
				}

				if( !common.isSameNode(end) ){
                    wrapUp(range, null, tag, false); 
				}
				
				range.surroundContents($document[0].createElement(tag));

                range.detach();

			} 

		};



/*
 
<p>
	ajhds;kfja;kldsfjads
	<bold>
		catacroquer 
		<mark>
			mark test
		</mark>
		hjrdfgkjdf
	</bold>
	jgkjg
</p>

<p>
	ajhds;kfja;kldsfjads
	<bold>
		catacroquer 
		<mark>
			mark
			</mark>
	</bold>
	<mark>
	<bold>
		 
			test
		</mark>
		hjrdfgkjdf
	</bold>
	jgkjg
</p>

seleccionar neque eu enim. Donec orci lectus ali

llamadas

markUp(range, cont, offset, tagName, direction)
markUp(range, "aliquam",    4, tagName, <- )     wI( end: "aliquam", 4, wrapperNode, <- )
markUp(range, "lectus",     0, tagName, <- )     wI( "lectus", 0 , wrapperNode, -> )
markUp(range, "",     0, tagName, <- )     wI( "lectus", 0 , wrapperNode, -> )

<p>
    Aenean commodo ligula eget dolor. Praesent turpis. Praesent egestas neque eu enim. 
    <b>
        Donec orci 
    </b>
    <i>
        <b>
            lectus, 
            <mark>
                aliquam
            </mark>
        </b> 
        ut
    </i>
    , faucibus non, euismod id, nulla. Duis leo.
</p>
 
 
 
*/


















		return function(taDefaultWrap){
			taDefaultWrap = taBrowserTag(taDefaultWrap);
			return function(command, showUI, options){
				var i, $target, html, _nodes, next;
				var defaultWrapper = angular.element('<' + taDefaultWrap + '>');
				var selectedElement = taSelection.getSelectionElement();
				var $selected = angular.element(selectedElement);
				if(selectedElement !== undefined){
					var tagName = selectedElement.tagName.toLowerCase();
					if(command.toLowerCase() === 'insertorderedlist' || command.toLowerCase() === 'insertunorderedlist'){
						var selfTag = taBrowserTag((command.toLowerCase() === 'insertorderedlist')? 'ol' : 'ul');
						if(tagName === selfTag){
							// if all selected then we should remove the list
							// grab all li elements and convert to taDefaultWrap tags
							return listToDefault($selected, taDefaultWrap);
						}else if(tagName === 'li' && $selected.parent()[0].tagName.toLowerCase() === selfTag && $selected.parent().children().length === 1){
							// catch for the previous statement if only one li exists
							return listToDefault($selected.parent(), taDefaultWrap);
						}else if(tagName === 'li' && $selected.parent()[0].tagName.toLowerCase() !== selfTag && $selected.parent().children().length === 1){
							// catch for the previous statement if only one li exists
							return listToList($selected.parent(), selfTag);
						}else if(tagName.match(BLOCKELEMENTS) && !$selected.hasClass('ta-bind')){
							// if it's one of those block elements we have to change the contents
							// if it's a ol/ul we are changing from one to the other
							if(tagName === 'ol' || tagName === 'ul'){
								return listToList($selected, selfTag);
							}else{
								if(selectedElement.innerHTML.match(BLOCKELEMENTS)){
									return childElementsToList($selected.children(), $selected, selfTag);
								}else{
									return childElementsToList(angular.element('<div>' + selectedElement.innerHTML + '</div>'), $selected, selfTag);
								}
							}
						}else if(tagName.match(BLOCKELEMENTS)){
							// if we get here then all the contents of the ta-bind are selected
							_nodes = taSelection.getOnlySelectedElements();
							if(_nodes.length === 1 && (_nodes[0].tagName.toLowerCase() === 'ol' || _nodes[0].tagName.toLowerCase() === 'ul')){
								if(_nodes[0].tagName.toLowerCase() === selfTag){
									// remove
									return listToDefault(angular.element(_nodes[0]), taDefaultWrap);
								}else{
									return listToList(angular.element(_nodes[0]), selfTag);
								}
							}else{
								html = '';
								var $nodes = [];
								for(i = 0; i < _nodes.length; i++){
									/* istanbul ignore else: catch for real-world can't make it occur in testing */
									if(_nodes[i].nodeType !== 3){
										var $n = angular.element(_nodes[i]);
										html += '<' + taBrowserTag('li') + '>' + $n[0].innerHTML + '</' + taBrowserTag('li') + '>';
										$nodes.unshift($n);
									}
								}
								$target = angular.element('<' + selfTag + '>' + html + '</' + selfTag + '>');
								$nodes.pop().replaceWith($target);
								angular.forEach($nodes, function($node){ $node.remove(); });
							}
							taSelection.setSelectionToElementEnd($target[0]);
							return;
						}
					}else if(command.toLowerCase() === 'formatblock' && 'blockquote' === options.toLowerCase().replace(/[<>]/ig, '')){
						if(tagName === 'li') $target = $selected.parent();
						else $target = $selected;
						// find the first blockElement
						while(!$target[0].tagName.match(BLOCKELEMENTS)){
							$target = $target.parent();
							tagName = $target[0].tagName.toLowerCase();
						}
						if(tagName === options.toLowerCase().replace(/[<>]/ig, '')){
							// $target is wrap element
							_nodes = $target.children();
							var hasBlock = false;
							for(i = 0; i < _nodes.length; i++){
								hasBlock = hasBlock || _nodes[i].tagName.match(BLOCKELEMENTS);
							}
							if(hasBlock){
								$target.after(_nodes);
								next = $target.next();
								$target.remove();
								$target = next;
							}else{
								defaultWrapper.append($target[0].childNodes);
								$target.after(defaultWrapper);
								$target.remove();
								$target = defaultWrapper;
							}
						}else if($target.parent()[0].tagName.toLowerCase() === options.toLowerCase().replace(/[<>]/ig, '') && !$target.parent().hasClass('ta-bind')){
							//unwrap logic for parent
							var blockElement = $target.parent();
							var contents = blockElement.contents();
							for(i = 0; i < contents.length; i ++){
								/* istanbul ignore next: can't test - some wierd thing with how phantomjs works */
								if(blockElement.parent().hasClass('ta-bind') && contents[i].nodeType === 3){
									defaultWrapper = angular.element('<' + taDefaultWrap + '>');
									defaultWrapper[0].innerHTML = contents[i].outerHTML;
									contents[i] = defaultWrapper[0];
								}
								blockElement.parent()[0].insertBefore(contents[i], blockElement[0]);
							}
							blockElement.remove();
						}else if(tagName.match(LISTELEMENTS)){
							// wrapping a list element
							$target.wrap(options);
						}else{
							// default wrap behaviour
							_nodes = taSelection.getOnlySelectedElements();
							if(_nodes.length === 0) _nodes = [$target[0]];
							html = '';
							if(_nodes.length === 1 && _nodes[0].nodeType === 3){
								var _node = _nodes[0].parentNode;
								while(!_node.tagName.match(BLOCKELEMENTS)){
									_node = _node.parentNode;
								}
								_nodes = [_node];
							}
							for(i = 0; i < _nodes.length; i++){
								html += _nodes[i].outerHTML;
							}
							$target = angular.element(options);
							$target[0].innerHTML = html;
							_nodes[0].parentNode.insertBefore($target[0],_nodes[0]);
							angular.forEach(_nodes, function(node){ node.parentNode.removeChild(node); });
						}
						taSelection.setSelectionToElementEnd($target[0]);
						return;
					}else if(command.toLowerCase() === 'customtag' && options.toLowerCase().replace(/[<>]/ig, '').length > 0){
                         wrapSelectionWithTag(options);

                    }
				}
				try{
					$document[0].execCommand(command, showUI, options);
				}catch(e){}
			};
		};
	}]).directive('taBind', ['taSanitize', '$timeout', '$window', '$document', 'taFixChrome', 'taBrowserTag', 'taSelection', 'taSelectableElements', 'taApplyCustomRenderers',
					function(taSanitize, $timeout, $window, $document, taFixChrome, taBrowserTag, taSelection, taSelectableElements, taApplyCustomRenderers){
		// Uses for this are textarea or input with ng-model and ta-bind='text'
		// OR any non-form element with contenteditable="contenteditable" ta-bind="html|text" ng-model
		return {
			require: 'ngModel',
			scope: {},
			link: function(scope, element, attrs, ngModel){
				// the option to use taBind on an input or textarea is required as it will sanitize all input into it correctly.
				var _isContentEditable = element.attr('contenteditable') !== undefined && element.attr('contenteditable');
				var _isInputFriendly = _isContentEditable || element[0].tagName.toLowerCase() === 'textarea' || element[0].tagName.toLowerCase() === 'input';
				var _isReadonly = false;
				var _focussed = false;
				
				// defaults to the paragraph element, but we need the line-break or it doesn't allow you to type into the empty element
				// non IE is '<p><br/></p>', ie is '<p></p>' as for once IE gets it correct...
				var _defaultVal, _defaultTest;
				// set the default to be a paragraph value
				if(attrs.taDefaultWrap === undefined) attrs.taDefaultWrap = 'p';
				/* istanbul ignore next: ie specific test */
				if(attrs.taDefaultWrap === ''){
					_defaultVal = '';
					_defaultTest = (ie === undefined)? '<div><br></div>' : (ie >= 11)? '<p><br></p>' : (ie <= 8)? '<P>&nbsp;</P>' : '<p>&nbsp;</p>';
				}else{
					_defaultVal = (ie === undefined || ie >= 11)?
						'<' + attrs.taDefaultWrap + '><br></' + attrs.taDefaultWrap + '>' :
						(ie <= 8)?
							'<' + attrs.taDefaultWrap.toUpperCase() + '></' + attrs.taDefaultWrap.toUpperCase() + '>' :
							'<' + attrs.taDefaultWrap + '></' + attrs.taDefaultWrap + '>';
					_defaultTest = (ie === undefined || ie >= 11)?
						'<' + attrs.taDefaultWrap + '><br></' + attrs.taDefaultWrap + '>' :
						(ie <= 8)?
							'<' + attrs.taDefaultWrap.toUpperCase() + '>&nbsp;</' + attrs.taDefaultWrap.toUpperCase() + '>' :
							'<' + attrs.taDefaultWrap + '>&nbsp;</' + attrs.taDefaultWrap + '>';
				}
				
				element.addClass('ta-bind');
				
				// in here we are undoing the converts used elsewhere to prevent the < > and & being displayed when they shouldn't in the code.
				var _compileHtml = function(){
					if(_isContentEditable) return element[0].innerHTML;
					if(_isInputFriendly) return element.val();
					throw ('textAngular Error: attempting to update non-editable taBind');
				};

				//used for updating when inserting wrapped elements
				scope.$parent['updateTaBind' + (attrs.id || '')] = function(){
					if(!_isReadonly) ngModel.$setViewValue(_compileHtml());
				};

				//this code is used to update the models when data is entered/deleted
				if(_isInputFriendly){
					if(!_isContentEditable){
						element.on('paste cut', function(){
							// timeout to next is needed as otherwise the paste/cut event has not finished actually changing the display
							if(!_isReadonly) $timeout(function(){
								ngModel.$setViewValue(_compileHtml());
							}, 0);
						});
						// if a textarea or input just add in change and blur handlers, everything else is done by angulars input directive
						element.on('change blur', function(){
							if(!_isReadonly) ngModel.$setViewValue(_compileHtml());
						});
					}else{
						element.on('cut', function(e){
							// timeout to next is needed as otherwise the paste/cut event has not finished actually changing the display
							if(!_isReadonly)
								$timeout(function(){
									ngModel.$setViewValue(_compileHtml());
								}, 0);
							else e.preventDefault();
						});
						element.on('paste', function(e, eventData){
							/* istanbul ignore else: this is for catching the jqLite testing*/
							if(eventData) angular.extend(e, eventData);
							var text;
							// for non-ie
							if(e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData))
								text = (e.originalEvent || e).clipboardData.getData('text/plain');
							// for ie
							else if($window.clipboardData)
								text = $window.clipboardData.getData('Text');
							// if theres non text data and we aren't in read-only do default
							if(!text && !_isReadonly) return true;
							// prevent the default paste command
							e.preventDefault();
							if(!_isReadonly){
								var _working = angular.element('<div></div>');
								_working[0].innerHTML = text;
								// this strips out all HTML tags
								text = _working.text();
								if ($document[0].selection){
									var range = $document[0].selection.createRange();
									range.pasteHTML(text);
								}
								else{
									$document[0].execCommand('insertText', false, text);
								}
								ngModel.$setViewValue(_compileHtml());
							}
						});
						
						// all the code specific to contenteditable divs
						element.on('keyup', function(event, eventData){
							/* istanbul ignore else: this is for catching the jqLite testing*/
							if(eventData) angular.extend(event, eventData);
							if(!_isReadonly){
								// if enter - insert new taDefaultWrap, if shift+enter insert <br/>
								if(_defaultVal !== '' && event.keyCode === 13){
									if(!event.shiftKey){
										// new paragraph, br should be caught correctly
										var selection = taSelection.getSelectionElement();
										if(selection.tagName.toLowerCase() !== attrs.taDefaultWrap && selection.tagName.toLowerCase() !== 'li' && (selection.innerHTML.trim() === '' || selection.innerHTML.trim() === '<br>')){
											var _new = angular.element(_defaultVal);
											angular.element(selection).replaceWith(_new);
											taSelection.setSelectionToElementStart(_new[0]);
										}
									}
								}
								var val = _compileHtml();
								if(_defaultVal !== '' && val.trim() === ''){
									element[0].innerHTML = _defaultVal;
									taSelection.setSelectionToElementStart(element.children()[0]);
								}
								ngModel.$setViewValue(val);
							}
						});

						element.on('blur', function(){
							_focussed = false;
							var val = _compileHtml();
							/* istanbul ignore else: if readonly don't update model */
							if(!_isReadonly){
								if(val === _defaultTest) ngModel.$setViewValue('');
								else ngModel.$setViewValue(_compileHtml());
							}
							ngModel.$render();
						});
						
						// Placeholders not supported on ie 8 and below
						if(attrs.placeholder && (ie > 8 || ie === undefined)){
							var ruleIndex;
							if(attrs.id) ruleIndex = addCSSRule('#' + attrs.id + '.placeholder-text:before', 'content: "' + attrs.placeholder + '"');
							else throw('textAngular Error: An unique ID is required for placeholders to work');
							
							scope.$on('$destroy', function(){
								removeCSSRule(ruleIndex);
							});
						}
						
						element.on('focus', function(){
							_focussed = true;
							ngModel.$render();
						});
					}
				}

				// catch DOM XSS via taSanitize
				// Sanitizing both ways is identical
				var _sanitize = function(unsafe){
					return (ngModel.$oldViewValue = taSanitize(taFixChrome(unsafe), ngModel.$oldViewValue));
				};

				// parsers trigger from the above keyup function or any other time that the viewValue is updated and parses it for storage in the ngModel
				ngModel.$parsers.push(_sanitize);
				// because textAngular is bi-directional (which is awesome) we need to also sanitize values going in from the server
				ngModel.$formatters.push(_sanitize);
				
				var selectorClickHandler = function(event){
					// emit the element-select event, pass the element
					scope.$emit('ta-element-select', this);
					event.preventDefault();
					return false;
				};
				var fileDropHandler = function(event, eventData){
					/* istanbul ignore else: this is for catching the jqLite testing*/
					if(eventData) angular.extend(event, eventData);
					// emit the drop event, pass the element, preventing should be done elsewhere
					if(!dropFired && !_isReadonly){
						dropFired = true;
						var dataTransfer;
						if(event.originalEvent) dataTransfer = event.originalEvent.dataTransfer;
						else dataTransfer = event.dataTransfer;
						scope.$emit('ta-drop-event', this, event, dataTransfer);
						$timeout(function(){dropFired = false;}, 100);
					}
				};
				
				//used for updating when inserting wrapped elements
				scope.$parent['reApplyOnSelectorHandlers' + (attrs.id || '')] = function(){
					/* istanbul ignore else */
					if(!_isReadonly) angular.forEach(taSelectableElements, function(selector){
							// check we don't apply the handler twice
							element.find(selector)
								.off('click', selectorClickHandler)
								.on('click', selectorClickHandler);
						});
				};
				
				// changes to the model variable from outside the html/text inputs
				ngModel.$render = function(){
					// catch model being null or undefined
					var val = ngModel.$viewValue || '';
					// if the editor isn't focused it needs to be updated, otherwise it's receiving user input
					if($document[0].activeElement !== element[0]){
						// Not focussed
						if(_isContentEditable){
							// WYSIWYG Mode
							if(attrs.placeholder){
								if(val === ''){
									// blank
									if(_focussed) element.removeClass('placeholder-text');
									else element.addClass('placeholder-text');
									element[0].innerHTML = _defaultVal;
								}else{
									// not-blank
									element.removeClass('placeholder-text');
									element[0].innerHTML = val;
								}
							}else{
								if(val === '') element[0].innerHTML = _defaultVal;
								else element[0].innerHTML = val;
							}
							// if in WYSIWYG and readOnly we kill the use of links by clicking
							if(!_isReadonly){
								angular.forEach(taSelectableElements, function(selector){
									element.find(selector).on('click', selectorClickHandler);
								});
								element.on('drop', fileDropHandler);
							}else{
								element.off('drop', fileDropHandler);
							}
						}else if(element[0].tagName.toLowerCase() !== 'textarea' && element[0].tagName.toLowerCase() !== 'input'){
							// make sure the end user can SEE the html code as a display. This is a read-only display element
							element[0].innerHTML = taApplyCustomRenderers(val);
						}else{
							// only for input and textarea inputs
							element.val(val);
						}
					}else{
						/* istanbul ignore else: in other cases we don't care */
						if(_isContentEditable){
							// element is focussed, test for placeholder
							element.removeClass('placeholder-text');
						}
					}
				};

				if(attrs.taReadonly){
					//set initial value
					_isReadonly = scope.$parent.$eval(attrs.taReadonly);
					if(_isReadonly){
						element.addClass('ta-readonly');
						// we changed to readOnly mode (taReadonly='true')
						if(element[0].tagName.toLowerCase() === 'textarea' || element[0].tagName.toLowerCase() === 'input'){
							element.attr('disabled', 'disabled');
						}
						if(element.attr('contenteditable') !== undefined && element.attr('contenteditable')){
							element.removeAttr('contenteditable');
						}
					}else{
						element.removeClass('ta-readonly');
						// we changed to NOT readOnly mode (taReadonly='false')
						if(element[0].tagName.toLowerCase() === 'textarea' || element[0].tagName.toLowerCase() === 'input'){
							element.removeAttr('disabled');
						}else if(_isContentEditable){
							element.attr('contenteditable', 'true');
						}
					}
					// taReadonly only has an effect if the taBind element is an input or textarea or has contenteditable='true' on it.
					// Otherwise it is readonly by default
					scope.$parent.$watch(attrs.taReadonly, function(newVal, oldVal){
						if(oldVal === newVal) return;
						if(newVal){
							element.addClass('ta-readonly');
							// we changed to readOnly mode (taReadonly='true')
							if(element[0].tagName.toLowerCase() === 'textarea' || element[0].tagName.toLowerCase() === 'input'){
								element.attr('disabled', 'disabled');
							}
							if(element.attr('contenteditable') !== undefined && element.attr('contenteditable')){
								element.removeAttr('contenteditable');
							}
							// turn ON selector click handlers
							angular.forEach(taSelectableElements, function(selector){
								element.find(selector).on('click', selectorClickHandler);
							});
							element.off('drop', fileDropHandler);
						}else{
							element.removeClass('ta-readonly');
							// we changed to NOT readOnly mode (taReadonly='false')
							if(element[0].tagName.toLowerCase() === 'textarea' || element[0].tagName.toLowerCase() === 'input'){
								element.removeAttr('disabled');
							}else if(_isContentEditable){
								element.attr('contenteditable', 'true');
							}
							// remove the selector click handlers
							angular.forEach(taSelectableElements, function(selector){
								element.find(selector).off('click', selectorClickHandler);
							});
							element.on('drop', fileDropHandler);
						}
						_isReadonly = newVal;
					});
				}
				
				// Initialise the selectableElements
				// if in WYSIWYG and readOnly we kill the use of links by clicking
				if(_isContentEditable && !_isReadonly){
					angular.forEach(taSelectableElements, function(selector){
						element.find(selector).on('click', selectorClickHandler);
					});
					element.on('drop', fileDropHandler);
					element.on('blur', function(){
						/* istanbul ignore next: webkit fix */
						if(/AppleWebKit\/([\d.]+)/.exec(navigator.userAgent)) { // detect webkit
							globalContentEditableBlur = true;
						}
					});
				}
			}
		};
	}]).factory('taApplyCustomRenderers', ['taCustomRenderers', function(taCustomRenderers){
		return function(val){
			var element = angular.element('<div></div>');
			element[0].innerHTML = val;
			
			angular.forEach(taCustomRenderers, function(renderer){
				var elements = [];
				// get elements based on what is defined. If both defined do secondary filter in the forEach after using selector string
				if(renderer.selector && renderer.selector !== '')
					elements = element.find(renderer.selector);
				/* istanbul ignore else: shouldn't fire, if it does we're ignoring everything */
				else if(renderer.customAttribute && renderer.customAttribute !== '')
					elements = getByAttribute(element, renderer.customAttribute);
				// process elements if any found
				angular.forEach(elements, function(_element){
					_element = angular.element(_element);
					if(renderer.selector && renderer.selector !== '' && renderer.customAttribute && renderer.customAttribute !== ''){
						if(_element.attr(renderer.customAttribute) !== undefined) renderer.renderLogic(_element);
					} else renderer.renderLogic(_element);
				});
			});
			
			return element[0].innerHTML;
		};
	}]).directive('taMaxText', function(){
		return {
			restrict: 'A',
			require: 'ngModel',
			link: function(scope, elem, attrs, ctrl){
				var max = parseInt(scope.$eval(attrs.taMaxText));
				if (isNaN(max)){
					throw('Max text must be an integer');
				}
				attrs.$observe('taMaxText', function(value){
					max = parseInt(value);
					if (isNaN(max)){
						throw('Max text must be an integer');
					}
					if (ctrl.$dirty){
						ctrl.$setViewValue(ctrl.$viewValue);
					}
				});
				function validator (viewValue){
					var source = angular.element('<div/>');
					source.html(viewValue);
					var length = source.text().length;
					if (length <= max){
						ctrl.$setValidity('taMaxText', true);
						return viewValue;
					}
					else{
						ctrl.$setValidity('taMaxText', false);
						return undefined;
					}
				}
				ctrl.$parsers.unshift(validator);
			}
		};
	}).factory('taFixChrome', function(){
		// get whaterever rubbish is inserted in chrome
		// should be passed an html string, returns an html string
		var taFixChrome = function(html){
			// default wrapper is a span so find all of them
			var $html = angular.element('<div>' + html + '</div>');
			var spans = angular.element($html).find('span');
			for(var s = 0; s < spans.length; s++){
				var span = angular.element(spans[s]);
				// chrome specific string that gets inserted into the style attribute, other parts may vary. Second part is specific ONLY to hitting backspace in Headers
				if(span.attr('style') && span.attr('style').match(/line-height: 1.428571429;|color: inherit; line-height: 1.1;/i)){
					span.attr('style', span.attr('style').replace(/( |)font-family: inherit;|( |)line-height: 1.428571429;|( |)line-height:1.1;|( |)color: inherit;/ig, ''));
					if(!span.attr('style') || span.attr('style') === ''){
						if(span.next().length > 0 && span.next()[0].tagName === 'BR') span.next().remove();
						span.replaceWith(span[0].innerHTML);
					}
				}
			}
			// regex to replace ONLY offending styles - these can be inserted into various other tags on delete
			var result = $html[0].innerHTML.replace(/style="[^"]*?(line-height: 1.428571429;|color: inherit; line-height: 1.1;)[^"]*"/ig, '');
			// only replace when something has changed, else we get focus problems on inserting lists
			if(result !== $html[0].innerHTML) $html[0].innerHTML = result;
			return $html[0].innerHTML;
		};
		return taFixChrome;
	}).factory('taSanitize', ['$sanitize', function taSanitizeFactory($sanitize){
		return function taSanitize(unsafe, oldsafe){
			// unsafe and oldsafe should be valid HTML strings
			// any exceptions (lets say, color for example) should be made here but with great care
			// setup unsafe element for modification
			var unsafeElement = angular.element('<div>' + unsafe + '</div>');
			// replace all align='...' tags with text-align attributes
			angular.forEach(getByAttribute(unsafeElement, 'align'), function(element){
				element.css('text-align', element.attr('align'));
				element.removeAttr('align');
			});

			// get the html string back
			unsafe = unsafeElement[0].innerHTML;
			var safe;
			try {
				safe = $sanitize(unsafe);
			} catch (e){
				safe = oldsafe || '';
			}
			return safe;
		};
	}]).directive('textAngularToolbar', [
		'$compile', 'textAngularManager', 'taOptions', 'taTools', 'taToolExecuteAction', '$window',
		function($compile, textAngularManager, taOptions, taTools, taToolExecuteAction, $window){
			return {
				scope: {
					name: '@' // a name IS required
				},
				restrict: "EA",
				link: function(scope, element, attrs){
					if(!scope.name || scope.name === '') throw('textAngular Error: A toolbar requires a name');
					angular.extend(scope, angular.copy(taOptions));
					if(attrs.taToolbar)						scope.toolbar = scope.$parent.$eval(attrs.taToolbar);
					if(attrs.taToolbarClass)				scope.classes.toolbar = attrs.taToolbarClass;
					if(attrs.taToolbarGroupClass)			scope.classes.toolbarGroup = attrs.taToolbarGroupClass;
					if(attrs.taToolbarButtonClass)			scope.classes.toolbarButton = attrs.taToolbarButtonClass;
					if(attrs.taToolbarActiveButtonClass)	scope.classes.toolbarButtonActive = attrs.taToolbarActiveButtonClass;
					if(attrs.taFocussedClass)				scope.classes.focussed = attrs.taFocussedClass;

					scope.disabled = true;
					scope.focussed = false;
					scope._$element = element;
					element[0].innerHTML = '';
					element.addClass("ta-toolbar " + scope.classes.toolbar);

					scope.$watch('focussed', function(){
						if(scope.focussed) element.addClass(scope.classes.focussed);
						else element.removeClass(scope.classes.focussed);
					});
					
					var setupToolElement = function(toolDefinition, toolScope){
						var toolElement;
						if(toolDefinition && toolDefinition.display){
							toolElement = angular.element(toolDefinition.display);
						}
						else toolElement = angular.element("<button type='button'>");

						toolElement.addClass(scope.classes.toolbarButton);
						toolElement.attr('name', toolScope.name);
						// important to not take focus from the main text/html entry
						toolElement.attr('unselectable', 'on');
						toolElement.attr('ng-disabled', 'isDisabled()');
						toolElement.attr('tabindex', '-1');
						toolElement.attr('ng-click', 'executeAction()');
						toolElement.attr('ng-class', 'displayActiveToolClass(active)');
						toolElement.on('mousedown', function(e, eventData){
							/* istanbul ignore else: this is for catching the jqLite testing*/
							if(eventData) angular.extend(e, eventData);
							// this prevents focusout from firing on the editor when clicking toolbar buttons
							e.preventDefault();
							return false;
						});
						if(toolDefinition && !toolDefinition.display && !toolScope._display){
							// first clear out the current contents if any
							toolElement[0].innerHTML = '';
							// add the buttonText
							if(toolDefinition.buttontext) toolElement[0].innerHTML = toolDefinition.buttontext;
							// add the icon to the front of the button if there is content
							if(toolDefinition.iconclass){
								var icon = angular.element('<i>'), content = toolElement[0].innerHTML;
								icon.addClass(toolDefinition.iconclass);
								toolElement[0].innerHTML = '';
								toolElement.append(icon);
								if(content && content !== '') toolElement.append('&nbsp;' + content);
							}
						}

						toolScope._lastToolDefinition = angular.copy(toolDefinition);

						return $compile(toolElement)(toolScope);
					};

					// Keep a reference for updating the active states later
					scope.tools = {};
					// create the tools in the toolbar
					// default functions and values to prevent errors in testing and on init
					scope._parent = {
						disabled: true,
						showHtml: false,
						queryFormatBlockState: function(){ return false; }
					};
					var defaultChildScope = {
						$window: $window,
						$editor: function(){
							// dynamically gets the editor as it is set
							return scope._parent;
						},
						isDisabled: function(){
							// to set your own disabled logic set a function or boolean on the tool called 'disabled'
							return ( // this bracket is important as without it it just returns the first bracket and ignores the rest
								// when the button's disabled function/value evaluates to true
								this.$eval('disabled') || this.$eval('disabled()') ||
								// all buttons except the HTML Switch button should be disabled in the showHtml (RAW html) mode
								(this.name !== 'html' && this.$editor().showHtml) ||
								// if the toolbar is disabled
								this.$parent.disabled ||
								// if the current editor is disabled
								this.$editor().disabled
							);
						},
						displayActiveToolClass: function(active){
							return (active)? scope.classes.toolbarButtonActive : '';
						},
						executeAction: taToolExecuteAction
					};

					angular.forEach(scope.toolbar, function(group){
						// setup the toolbar group
						var groupElement = angular.element("<div>");
						groupElement.addClass(scope.classes.toolbarGroup);
						angular.forEach(group, function(tool){
							// init and add the tools to the group
							// a tool name (key name from taTools struct)
							//creates a child scope of the main angularText scope and then extends the childScope with the functions of this particular tool
							// reference to the scope and element kept
							scope.tools[tool] = angular.extend(scope.$new(true), taTools[tool], defaultChildScope, {name: tool});
							scope.tools[tool].$element = setupToolElement(taTools[tool], scope.tools[tool]);
							// append the tool compiled with the childScope to the group element
							groupElement.append(scope.tools[tool].$element);
						});
						// append the group to the toolbar
						element.append(groupElement);
					});

					// update a tool
					// if a value is set to null, remove from the display
					// when forceNew is set to true it will ignore all previous settings, used to reset to taTools definition
					// to reset to defaults pass in taTools[key] as _newTool and forceNew as true, ie `updateToolDisplay(key, taTools[key], true);`
					scope.updateToolDisplay = function(key, _newTool, forceNew){
						var toolInstance = scope.tools[key];
						if(toolInstance){
							// get the last toolDefinition, then override with the new definition
							if(toolInstance._lastToolDefinition && !forceNew) _newTool = angular.extend({}, toolInstance._lastToolDefinition, _newTool);
							if(_newTool.buttontext === null && _newTool.iconclass === null && _newTool.display === null)
								throw('textAngular Error: Tool Definition for updating "' + key + '" does not have a valid display/iconclass/buttontext value');

							// if tool is defined on this toolbar, update/redo the tool
							if(_newTool.buttontext === null){
								delete _newTool.buttontext;
							}
							if(_newTool.iconclass === null){
								delete _newTool.iconclass;
							}
							if(_newTool.display === null){
								delete _newTool.display;
							}

							var toolElement = setupToolElement(_newTool, toolInstance);
							toolInstance.$element.replaceWith(toolElement);
							toolInstance.$element = toolElement;
						}
					};
					
					// we assume here that all values passed are valid and correct
					scope.addTool = function(key, _newTool, groupIndex, index){
						scope.tools[key] = angular.extend(scope.$new(true), taTools[key], defaultChildScope, {name: key});
						scope.tools[key].$element = setupToolElement(taTools[key], scope.tools[key]);
						var group;
						if(groupIndex === undefined) groupIndex = scope.toolbar.length - 1;
						group = angular.element(element.children()[groupIndex]);
						
						if(index === undefined){
							group.append(scope.tools[key].$element);
							scope.toolbar[groupIndex][scope.toolbar[groupIndex].length - 1] = key;
						}else{
							group.children().eq(index).after(scope.tools[key].$element);
							scope.toolbar[groupIndex][index] = key;
						}
					};
					
					textAngularManager.registerToolbar(scope);

					scope.$on('$destroy', function(){
						textAngularManager.unregisterToolbar(scope.name);
					});
				}
			};
		}
	]).service('taToolExecuteAction', ['$q', function($q){
		// this must be called on a toolScope or instance
		return function(editor){
			if(editor !== undefined) this.$editor = function(){ return editor; };
			var deferred = $q.defer(),
				promise = deferred.promise,
				_editor = this.$editor();
			promise['finally'](function(){
				_editor.endAction.call(_editor);
			});
			// pass into the action the deferred function and also the function to reload the current selection if rangy available
			var result;
			try{
				result = this.action(deferred, _editor.startAction());
			}catch(any){}
			if(result || result === undefined){
				// if true or undefined is returned then the action has finished. Otherwise the deferred action will be resolved manually.
				deferred.resolve();
			}
		};
	}]).service('textAngularManager', ['taToolExecuteAction', 'taTools', 'taRegisterTool', function(taToolExecuteAction, taTools, taRegisterTool){
		// this service is used to manage all textAngular editors and toolbars.
		// All publicly published functions that modify/need to access the toolbar or editor scopes should be in here
		// these contain references to all the editors and toolbars that have been initialised in this app
		var toolbars = {}, editors = {};
		// when we focus into a toolbar, we need to set the TOOLBAR's $parent to be the toolbars it's linked to.
		// We also need to set the tools to be updated to be the toolbars...
		return {
			// register an editor and the toolbars that it is affected by
			registerEditor: function(name, scope, targetToolbars){
				// targetToolbars are optional, we don't require a toolbar to function
				if(!name || name === '') throw('textAngular Error: An editor requires a name');
				if(!scope) throw('textAngular Error: An editor requires a scope');
				if(editors[name]) throw('textAngular Error: An Editor with name "' + name + '" already exists');
				// _toolbars is an ARRAY of toolbar scopes
				var _toolbars = [];
				angular.forEach(targetToolbars, function(_name){
					if(toolbars[_name]) _toolbars.push(toolbars[_name]);
					// if it doesn't exist it may not have been compiled yet and it will be added later
				});
				editors[name] = {
					scope: scope,
					toolbars: targetToolbars,
					_registerToolbar: function(toolbarScope){
						// add to the list late
						if(this.toolbars.indexOf(toolbarScope.name) >= 0) _toolbars.push(toolbarScope);
					},
					// this is a suite of functions the editor should use to update all it's linked toolbars
					editorFunctions: {
						disable: function(){
							// disable all linked toolbars
							angular.forEach(_toolbars, function(toolbarScope){ toolbarScope.disabled = true; });
						},
						enable: function(){
							// enable all linked toolbars
							angular.forEach(_toolbars, function(toolbarScope){ toolbarScope.disabled = false; });
						},
						focus: function(){
							// this should be called when the editor is focussed
							angular.forEach(_toolbars, function(toolbarScope){
								toolbarScope._parent = scope;
								toolbarScope.disabled = false;
								toolbarScope.focussed = true;
							});
						},
						unfocus: function(){
							// this should be called when the editor becomes unfocussed
							angular.forEach(_toolbars, function(toolbarScope){
								toolbarScope.disabled = true;
								toolbarScope.focussed = false;
							});
						},
						updateSelectedStyles: function(selectedElement){
							// update the active state of all buttons on liked toolbars
							angular.forEach(_toolbars, function(toolbarScope){
								angular.forEach(toolbarScope.tools, function(toolScope){
									if(toolScope.activeState){
										toolScope.active = toolScope.activeState(selectedElement);
									}
								});
							});
						},
						sendKeyCommand: function(event){
							// we return true if we applied an action, false otherwise
							var result = false;
							if(event.ctrlKey || event.metaKey) angular.forEach(taTools, function(tool, name){
								if(tool.commandKeyCode && tool.commandKeyCode === event.which){
									for(var _t = 0; _t < _toolbars.length; _t++){
										if(_toolbars[_t].tools[name] !== undefined){
											taToolExecuteAction.call(_toolbars[_t].tools[name], scope);
											result = true;
											break;
										}
									}
								}
							});
							return result;
						},
						triggerElementSelect: function(event, element){
							// search through the taTools to see if a match for the tag is made.
							// if there is, see if the tool is on a registered toolbar and not disabled.
							// NOTE: This can trigger on MULTIPLE tools simultaneously.
							var elementHasAttrs = function(_element, attrs){
								var result = true;
								for(var i = 0; i < attrs.length; i++) result = result && _element.attr(attrs[i]);
								return result;
							};
							var workerTools = [];
							var unfilteredTools = {};
							var result = false;
							element = angular.element(element);
							// get all valid tools by element name, keep track if one matches the 
							var onlyWithAttrsFilter = false;
							angular.forEach(taTools, function(tool, name){
								if(
									tool.onElementSelect &&
									tool.onElementSelect.element &&
									tool.onElementSelect.element.toLowerCase() === element[0].tagName.toLowerCase() &&
									(!tool.onElementSelect.filter || tool.onElementSelect.filter(element))
								){
									// this should only end up true if the element matches the only attributes
									onlyWithAttrsFilter = onlyWithAttrsFilter ||
										(angular.isArray(tool.onElementSelect.onlyWithAttrs) && elementHasAttrs(element, tool.onElementSelect.onlyWithAttrs));
									if(!tool.onElementSelect.onlyWithAttrs || elementHasAttrs(element, tool.onElementSelect.onlyWithAttrs)) unfilteredTools[name] = tool;
								}
							});
							// if we matched attributes to filter on, then filter, else continue
							if(onlyWithAttrsFilter){
								angular.forEach(unfilteredTools, function(tool, name){
									if(tool.onElementSelect.onlyWithAttrs && elementHasAttrs(element, tool.onElementSelect.onlyWithAttrs)) workerTools.push({'name': name, 'tool': tool});
								});
								// sort most specific (most attrs to find) first
								workerTools.sort(function(a,b){
									return b.tool.onElementSelect.onlyWithAttrs.length - a.tool.onElementSelect.onlyWithAttrs.length;
								});
							}else{
								angular.forEach(unfilteredTools, function(tool, name){
									workerTools.push({'name': name, 'tool': tool});
								});
							}
							// Run the actions on the first filtered tool only
							if(workerTools.length > 0){
								var tool = workerTools[0].tool;
								var name = workerTools[0].name;
								for(var _t = 0; _t < _toolbars.length; _t++){
									if(_toolbars[_t].tools[name] !== undefined){
										tool.onElementSelect.action.call(_toolbars[_t].tools[name], event, element, scope);
										result = true;
										break;
									}
								}
							}
							return result;
						}
					}
				};
				return editors[name].editorFunctions;
			},
			// retrieve editor by name, largely used by testing suites only
			retrieveEditor: function(name){
				return editors[name];
			},
			unregisterEditor: function(name){
				delete editors[name];
			},
			// registers a toolbar such that it can be linked to editors
			registerToolbar: function(scope){
				if(!scope) throw('textAngular Error: A toolbar requires a scope');
				if(!scope.name || scope.name === '') throw('textAngular Error: A toolbar requires a name');
				if(toolbars[scope.name]) throw('textAngular Error: A toolbar with name "' + scope.name + '" already exists');
				toolbars[scope.name] = scope;
				angular.forEach(editors, function(_editor){
					_editor._registerToolbar(scope);
				});
			},
			// retrieve toolbar by name, largely used by testing suites only
			retrieveToolbar: function(name){
				return toolbars[name];
			},
			// retrieve toolbars by editor name, largely used by testing suites only
			retrieveToolbarsViaEditor: function(name){
				var result = [], _this = this;
				angular.forEach(this.retrieveEditor(name).toolbars, function(name){
					result.push(_this.retrieveToolbar(name));
				});
				return result;
			},
			unregisterToolbar: function(name){
				delete toolbars[name];
			},
			// functions for updating the toolbar buttons display
			updateToolsDisplay: function(newTaTools){
				// pass a partial struct of the taTools, this allows us to update the tools on the fly, will not change the defaults.
				var _this = this;
				angular.forEach(newTaTools, function(_newTool, key){
					_this.updateToolDisplay(key, _newTool);
				});
			},
			// this function resets all toolbars to their default tool definitions
			resetToolsDisplay: function(){
				var _this = this;
				angular.forEach(taTools, function(_newTool, key){
					_this.resetToolDisplay(key);
				});
			},
			// update a tool on all toolbars
			updateToolDisplay: function(toolKey, _newTool){
				var _this = this;
				angular.forEach(toolbars, function(toolbarScope, toolbarKey){
					_this.updateToolbarToolDisplay(toolbarKey, toolKey, _newTool);
				});
			},
			// resets a tool to the default/starting state on all toolbars
			resetToolDisplay: function(toolKey){
				var _this = this;
				angular.forEach(toolbars, function(toolbarScope, toolbarKey){
					_this.resetToolbarToolDisplay(toolbarKey, toolKey);
				});
			},
			// update a tool on a specific toolbar
			updateToolbarToolDisplay: function(toolbarKey, toolKey, _newTool){
				if(toolbars[toolbarKey]) toolbars[toolbarKey].updateToolDisplay(toolKey, _newTool);
				else throw('textAngular Error: No Toolbar with name "' + toolbarKey + '" exists');
			},
			// reset a tool on a specific toolbar to it's default starting value
			resetToolbarToolDisplay: function(toolbarKey, toolKey){
				if(toolbars[toolbarKey]) toolbars[toolbarKey].updateToolDisplay(toolKey, taTools[toolKey], true);
				else throw('textAngular Error: No Toolbar with name "' + toolbarKey + '" exists');
			},
			// removes a tool from all toolbars and it's definition
			removeTool: function(toolKey){
				delete taTools[toolKey];
				angular.forEach(toolbars, function(toolbarScope){
					delete toolbarScope.tools[toolKey];
					for(var i = 0; i < toolbarScope.toolbar.length; i++){
						var toolbarIndex;
						for(var j = 0; j < toolbarScope.toolbar[i].length; j++){
							if(toolbarScope.toolbar[i][j] === toolKey){
								toolbarIndex = {
									group: i,
									index: j
								};
								break;
							}
							if(toolbarIndex !== undefined) break;
						}
						if(toolbarIndex !== undefined){
							toolbarScope.toolbar[toolbarIndex.group].slice(toolbarIndex.index, 1);
							toolbarScope._$element.children().eq(toolbarIndex.group).children().eq(toolbarIndex.index).remove();
						}
					}
				});
			},
			// toolkey, toolDefinition are required. If group is not specified will pick the last group, if index isnt defined will append to group
			addTool: function(toolKey, toolDefinition, group, index){
				taRegisterTool(toolKey, toolDefinition);
				angular.forEach(toolbars, function(toolbarScope){
					toolbarScope.addTool(toolKey, toolDefinition, group, index);
				});
			},
			// adds a Tool but only to one toolbar not all
			addToolToToolbar: function(toolKey, toolDefinition, toolbarKey, group, index){
				taRegisterTool(toolKey, toolDefinition);
				toolbars[toolbarKey].addTool(toolKey, toolDefinition, group, index);
			},
			// this is used when externally the html of an editor has been changed and textAngular needs to be notified to update the model.
			// this will call a $digest if not already happening
			refreshEditor: function(name){
				if(editors[name]){
					editors[name].scope.updateTaBindtaTextElement();
					/* istanbul ignore else: phase catch */
					if(!editors[name].scope.$$phase) editors[name].scope.$digest();
				}else throw('textAngular Error: No Editor with name "' + name + '" exists');
			}
		};
	}]).service('taSelection', ['$window', '$document',
	/* istanbul ignore next: all browser specifics and PhantomJS dosen't seem to support half of it */
	function($window, $document){
		// need to dereference the document else the calls don't work correctly
		_document = $document[0];
		var nextNode = function(node) {
			if (node.hasChildNodes()) {
				return node.firstChild;
			} else {
				while (node && !node.nextSibling) {
					node = node.parentNode;
				}
				if (!node) {
					return null;
				}
				return node.nextSibling;
			}
		};
		var getRangeSelectedNodes = function(range) {
			var node = range.startContainer;
			var endNode = range.endContainer;
		
			// Special case for a range that is contained within a single node
			if (node === endNode) {
				return [node];
			}
			// Iterate nodes until we hit the end container
			var rangeNodes = [];
			while (node && node !== endNode) {
				node = nextNode(node);
				if(node.parentNode === range.commonAncestorContainer) rangeNodes.push(node);
			}
			// Add partially selected nodes at the start of the range
			node = range.startContainer;
			while (node && node !== range.commonAncestorContainer) {
				if(node.parentNode === range.commonAncestorContainer) rangeNodes.unshift(node);
				node = node.parentNode;
			}
			return rangeNodes;
		};
		return {
			getOnlySelectedElements: function(){
				if (window.getSelection) {
					var sel = $window.getSelection();
					if (!sel.isCollapsed) {
						return getRangeSelectedNodes(sel.getRangeAt(0));
					}
				}
				return [];
			},
			// Some basic selection functions
			getSelectionElement: function () {
				var range, sel, container;
				if (_document.selection && _document.selection.createRange) {
					// IE case
					range = _document.selection.createRange();
					return range.parentElement();
				} else if ($window.getSelection) {
					sel = $window.getSelection();
					if (sel.getRangeAt) {
						if (sel.rangeCount > 0) {
							range = sel.getRangeAt(0);
						}
					} else {
						// Old WebKit selection object has no getRangeAt, so
						// create a range from other selection properties
						range = _document.createRange();
						range.setStart(sel.anchorNode, sel.anchorOffset);
						range.setEnd(sel.focusNode, sel.focusOffset);
						
						// Handle the case when the selection was selected backwards (from the end to the start in the document)
						if (range.collapsed !== sel.isCollapsed) {
							range.setStart(sel.focusNode, sel.focusOffset);
							range.setEnd(sel.anchorNode, sel.anchorOffset);
						}
					}
					
					if (range) {
						container = range.commonAncestorContainer;
						
						// Check if the container is a text node and return its parent if so
						return container.nodeType === 3 ? container.parentNode : container;
					}   
				}
			},
            // returns the text under the selection
            getSelection: function () {
                return $window.getSelection();
            },
			setSelectionToElementStart: function (el){
				if (_document.createRange && $window.getSelection) {
					var range = _document.createRange();
					range.selectNodeContents(el);
					range.setStart(el, 0);
					range.setEnd(el, 0);
					
					var sel = $window.getSelection();
					sel.removeAllRanges();
					sel.addRange(range);
				} else if (_document.selection && _document.body.createTextRange) {
					var textRange = _document.body.createTextRange();
					textRange.moveToElementText(el);
					textRange.collapse(true);
					textRange.moveEnd("character", 0);
					textRange.moveStart("character", 0);
					textRange.select();
				}
			},
			setSelectionToElementEnd: function (el){
				if (_document.createRange && $window.getSelection) {
					var range = _document.createRange();
					range.selectNodeContents(el);
					range.collapse(false);
					
					var sel = $window.getSelection();
					sel.removeAllRanges();
					sel.addRange(range);
				} else if (_document.selection && _document.body.createTextRange) {
					var textRange = _document.body.createTextRange();
					textRange.moveToElementText(el);
					textRange.collapse(false);
					textRange.select();
				}
			}
		};
	}]);
})();

/*
textAngular
Author : Austin Anderson
License : 2013 MIT
Version 1.2.1

See README.md or https://github.com/fraywing/textAngular/wiki for requirements and use.
*/
textAngularSetup = angular.module('textAngularSetup', []);
	
// Here we set up the global display defaults, to set your own use a angular $provider#decorator.
textAngularSetup.value('taOptions',  {
	toolbar: [
		['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'highlight', 'p', 'pre', 'quote'],
		['bold', 'italics', 'underline', 'ul', 'ol', 'redo', 'undo', 'clear'],
		['justifyLeft','justifyCenter','justifyRight','indent','outdent'],
		['html', 'insertImage', 'insertLink', 'insertVideo']
	],
	classes: {
		focussed: "focussed",
		toolbar: "btn-toolbar",
		toolbarGroup: "btn-group",
		toolbarButton: "btn btn-default",
		toolbarButtonActive: "active",
		disabled: "disabled",
		textEditor: 'form-control',
		htmlEditor: 'form-control'
	},
	setup: {
		// wysiwyg mode
		textEditorSetup: function($element){ /* Do some processing here */ },
		// raw html
		htmlEditorSetup: function($element){ /* Do some processing here */ }
	},
	defaultFileDropHandler:
		/* istanbul ignore next: untestable image processing */
		function(file, insertAction){
			var reader = new FileReader();
			if(file.type.substring(0, 5) === 'image'){
				reader.onload = function() {
					if(reader.result !== '') insertAction('insertImage', reader.result, true);
				};

				reader.readAsDataURL(file);
				return true;
			}
			return false;
		}
});

// This is the element selector string that is used to catch click events within a taBind, prevents the default and $emits a 'ta-element-select' event
// these are individually used in an angular.element().find() call. What can go here depends on whether you have full jQuery loaded or just jQLite with angularjs.
// div is only used as div.ta-insert-video caught in filter.
textAngularSetup.value('taSelectableElements', ['a','img']);

// This is an array of objects with the following options:
//				selector: <string> a jqLite or jQuery selector string
//				customAttribute: <string> an attribute to search for
//				renderLogic: <function(element)>
// Both or one of selector and customAttribute must be defined.
textAngularSetup.value('taCustomRenderers', [
	{
		// Parse back out: '<div class="ta-insert-video" ta-insert-video src="' + urlLink + '" allowfullscreen="true" width="300" frameborder="0" height="250"></div>'
		// To correct video element. For now only support youtube
		selector: 'img',
		customAttribute: 'ta-insert-video',
		renderLogic: function(element){
			var iframe = angular.element('<iframe></iframe>');
			var attributes = element.prop("attributes");
			// loop through element attributes and apply them on iframe
			angular.forEach(attributes, function(attr) {
				iframe.attr(attr.name, attr.value);
			});
			iframe.attr('src', iframe.attr('ta-insert-video'));
			element.replaceWith(iframe);
		}
	}
]);

textAngularSetup.constant('taTranslations', {
	toggleHTML: "Toggle HTML",
	insertImage: "Please enter a image URL to insert",
	insertLink: "Please enter a URL to insert",
	insertVideo: "Please enter a youtube URL to embed"
});

textAngularSetup.run(['taRegisterTool', '$window', 'taTranslations', 'taSelection', function(taRegisterTool, $window, taTranslations, taSelection){
	taRegisterTool("html", {
		buttontext: taTranslations.toggleHTML,
		action: function(){
			this.$editor().switchView();
		},
		activeState: function(){
			return this.$editor().showHtml;
		}
	});
	// add the Header tools
	// convenience functions so that the loop works correctly
	var _retActiveStateFunction = function(q){
		return function(){ return this.$editor().queryFormatBlockState(q); };
	};
	var headerAction = function(){
		return this.$editor().wrapSelection("formatBlock", "<" + this.name.toUpperCase() +">");
	};
	angular.forEach(['h1','h2','h3','h4','h5','h6'], function(h){
		taRegisterTool(h.toLowerCase(), {
			buttontext: h.toUpperCase(),
			action: headerAction,
			activeState: _retActiveStateFunction(h.toLowerCase())
		});
	});
	taRegisterTool('highlight', {
		isHighlighted: false,
		iconclass: 'fa fa-pencil',
		action: function() {
			//var color = this.isHighlighted ? 'transparent' : this.highlightColor;
			//this.isHighlighted = !this.isHighlighted;
			return this.$editor().wrapSelection("customTag", "<mark>");
            //this.$editor().wrapSelection('formatBlock', '<mark>');
		},
		activeState: function(){ 
            return 'activeState';    
          //this.$editor().queryFormatBlockState('<mark>'); 
        
        }
    });
	taRegisterTool('p', {
		buttontext: 'P',
		action: function(){
			return this.$editor().wrapSelection("formatBlock", "<P>");
		},
		activeState: function(){ return this.$editor().queryFormatBlockState('p'); }
	});
	taRegisterTool('pre', {
		buttontext: 'pre',
		action: function(){
			return this.$editor().wrapSelection("formatBlock", "<PRE>");
		},
		activeState: function(){ return this.$editor().queryFormatBlockState('pre'); }
	});
	taRegisterTool('ul', {
		iconclass: 'fa fa-list-ul',
		action: function(){
			return this.$editor().wrapSelection("insertUnorderedList", null);
		},
		activeState: function(){ return document.queryCommandState('insertUnorderedList'); }
	});
	taRegisterTool('ol', {
		iconclass: 'fa fa-list-ol',
		action: function(){
			return this.$editor().wrapSelection("insertOrderedList", null);
		},
		activeState: function(){ return document.queryCommandState('insertOrderedList'); }
	});
	taRegisterTool('quote', {
		iconclass: 'fa fa-quote-right',
		action: function(){
			return this.$editor().wrapSelection("formatBlock", "<BLOCKQUOTE>");
		},
		activeState: function(){ return this.$editor().queryFormatBlockState('blockquote'); }
	});
	taRegisterTool('undo', {
		iconclass: 'fa fa-undo',
		action: function(){
			return this.$editor().wrapSelection("undo", null);
		}
	});
	taRegisterTool('redo', {
		iconclass: 'fa fa-repeat',
		action: function(){
			return this.$editor().wrapSelection("redo", null);
		}
	});
	taRegisterTool('bold', {
		iconclass: 'fa fa-bold',
		action: function(){
			return this.$editor().wrapSelection("bold", null);
		},
		activeState: function(){
			return document.queryCommandState('bold');
		},
		commandKeyCode: 98
	});
	taRegisterTool('justifyLeft', {
		iconclass: 'fa fa-align-left',
		action: function(){
			return this.$editor().wrapSelection("justifyLeft", null);
		},
		activeState: function(commonElement){
			var result = false;
			if(commonElement) result = commonElement.css('text-align') === 'left' || commonElement.attr('align') === 'left' ||
				(commonElement.css('text-align') !== 'right' && commonElement.css('text-align') !== 'center' && !document.queryCommandState('justifyRight') && !document.queryCommandState('justifyCenter'));
			result = result || document.queryCommandState('justifyLeft');
			return result;
		}
	});
	taRegisterTool('justifyRight', {
		iconclass: 'fa fa-align-right',
		action: function(){
			return this.$editor().wrapSelection("justifyRight", null);
		},
		activeState: function(commonElement){
			var result = false;
			if(commonElement) result = commonElement.css('text-align') === 'right';
			result = result || document.queryCommandState('justifyRight');
			return result;
		}
	});
	taRegisterTool('justifyCenter', {
		iconclass: 'fa fa-align-center',
		action: function(){
			return this.$editor().wrapSelection("justifyCenter", null);
		},
		activeState: function(commonElement){
			var result = false;
			if(commonElement) result = commonElement.css('text-align') === 'center';
			result = result || document.queryCommandState('justifyCenter');
			return result;
		}
	});
	taRegisterTool('indent', {
		iconclass: 'fa fa-indent',
		tooltiptext: 'Indent',
		action: function(){
			return this.$editor().wrapSelection("indent", null);
		},
		activeState: function(){
			return this.$editor().queryFormatBlockState('blockquote'); 
		}
	});
	taRegisterTool('outdent', {
		iconclass: 'fa fa-outdent',
		tooltiptext: 'Outdent',
		action: function(){
			return this.$editor().wrapSelection("outdent", null);
		},
		activeState: function(){
			return false;
		}
	});
	taRegisterTool('italics', {
		iconclass: 'fa fa-italic',
		action: function(){
			return this.$editor().wrapSelection("italic", null);
		},
		activeState: function(){
			return document.queryCommandState('italic');
		},
		commandKeyCode: 105
	});
	taRegisterTool('underline', {
		iconclass: 'fa fa-underline',
		action: function(){
			return this.$editor().wrapSelection("underline", null);
		},
		activeState: function(){
			return document.queryCommandState('underline');
		},
		commandKeyCode: 117
	});
	taRegisterTool('clear', {
		iconclass: 'fa fa-ban',
		action: function(deferred, restoreSelection){
			this.$editor().wrapSelection("removeFormat", null);
			var possibleNodes = angular.element(taSelection.getSelectionElement());
			// remove lists
			var removeListElements = function(list){
				list = angular.element(list);
				var prevElement = list;
				angular.forEach(list.children(), function(liElem){
					var newElem = angular.element('<p></p>');
					newElem.html(angular.element(liElem).html());
					prevElement.after(newElem);
					prevElement = newElem;
				});
				list.remove();
			};
			angular.forEach(possibleNodes.find("ul"), removeListElements);
			angular.forEach(possibleNodes.find("ol"), removeListElements);
			// clear out all class attributes. These do not seem to be cleared via removeFormat
			var $editor = this.$editor();
			var recursiveRemoveClass = function(node){
				node = angular.element(node);
				if(node[0] !== $editor.displayElements.text[0]) node.removeAttr('class');
				angular.forEach(node.children(), recursiveRemoveClass);
			};
			angular.forEach(possibleNodes, recursiveRemoveClass);
			// check if in list. If not in list then use formatBlock option
			if(possibleNodes[0].tagName.toLowerCase() !== 'li' &&
				possibleNodes[0].tagName.toLowerCase() !== 'ol' &&
				possibleNodes[0].tagName.toLowerCase() !== 'ul') this.$editor().wrapSelection("formatBlock", "<p>");
			restoreSelection();
		}
	});
	
	var imgOnSelectAction = function(event, $element, editorScope){
		// setup the editor toolbar
		// Credit to the work at http://hackerwins.github.io/summernote/ for this editbar logic/display
		var finishEdit = function(){
			editorScope.updateTaBindtaTextElement();
			editorScope.hidePopover();
		};
		event.preventDefault();
		editorScope.displayElements.popover.css('width', '375px');
		var container = editorScope.displayElements.popoverContainer;
		container.empty();
		var buttonGroup = angular.element('<div class="btn-group" style="padding-right: 6px;">');
		var fullButton = angular.element('<button type="button" class="btn btn-default btn-sm btn-small" unselectable="on" tabindex="-1">100% </button>');
		fullButton.on('click', function(event){
			event.preventDefault();
			$element.css({
				'width': '100%',
				'height': ''
			});
			finishEdit();
		});
		var halfButton = angular.element('<button type="button" class="btn btn-default btn-sm btn-small" unselectable="on" tabindex="-1">50% </button>');
		halfButton.on('click', function(event){
			event.preventDefault();
			$element.css({
				'width': '50%',
				'height': ''
			});
			finishEdit();
		});
		var quartButton = angular.element('<button type="button" class="btn btn-default btn-sm btn-small" unselectable="on" tabindex="-1">25% </button>');
		quartButton.on('click', function(event){
			event.preventDefault();
			$element.css({
				'width': '25%',
				'height': ''
			});
			finishEdit();
		});
		var resetButton = angular.element('<button type="button" class="btn btn-default btn-sm btn-small" unselectable="on" tabindex="-1">Reset</button>');
		resetButton.on('click', function(event){
			event.preventDefault();
			$element.css({
				width: '',
				height: ''
			});
			finishEdit();
		});
		buttonGroup.append(fullButton);
		buttonGroup.append(halfButton);
		buttonGroup.append(quartButton);
		buttonGroup.append(resetButton);
		container.append(buttonGroup);
		
		buttonGroup = angular.element('<div class="btn-group" style="padding-right: 6px;">');
		var floatLeft = angular.element('<button type="button" class="btn btn-default btn-sm btn-small" unselectable="on" tabindex="-1"><i class="fa fa-align-left"></i></button>');
		floatLeft.on('click', function(event){
			event.preventDefault();
			$element.css('float', 'left');
			finishEdit();
		});
		var floatRight = angular.element('<button type="button" class="btn btn-default btn-sm btn-small" unselectable="on" tabindex="-1"><i class="fa fa-align-right"></i></button>');
		floatRight.on('click', function(event){
			event.preventDefault();
			$element.css('float', 'right');
			finishEdit();
		});
		var floatNone = angular.element('<button type="button" class="btn btn-default btn-sm btn-small" unselectable="on" tabindex="-1"><i class="fa fa-align-justify"></i></button>');
		floatNone.on('click', function(event){
			event.preventDefault();
			$element.css('float', '');
			finishEdit();
		});
		buttonGroup.append(floatLeft);
		buttonGroup.append(floatNone);
		buttonGroup.append(floatRight);
		container.append(buttonGroup);
		
		buttonGroup = angular.element('<div class="btn-group">');
		var remove = angular.element('<button type="button" class="btn btn-default btn-sm btn-small" unselectable="on" tabindex="-1"><i class="fa fa-trash-o"></i></button>');
		remove.on('click', function(event){
			event.preventDefault();
			$element.remove();
			finishEdit();
		});
		buttonGroup.append(remove);
		container.append(buttonGroup);
		
		editorScope.showPopover($element);
		editorScope.showResizeOverlay($element);
	};
	
	taRegisterTool('insertImage', {
		iconclass: 'fa fa-picture-o',
		action: function(){
			var imageLink;
			imageLink = $window.prompt(taTranslations.insertImage, 'http://');
			if(imageLink && imageLink !== '' && imageLink !== 'http://'){
				return this.$editor().wrapSelection('insertImage', imageLink, true);
			}
		},
		onElementSelect: {
			element: 'img',
			action: imgOnSelectAction
		}
	});
	taRegisterTool('insertVideo', {
		iconclass: 'fa fa-youtube-play',
		action: function(){
			var urlPrompt;
			urlPrompt = $window.prompt(taTranslations.insertVideo, 'http://');
			if (urlPrompt && urlPrompt !== '' && urlPrompt !== 'http://') {
				// get the video ID
				var ids = urlPrompt.match(/(\?|&)v=[^&]*/);
				/* istanbul ignore else: if it's invalid don't worry - though probably should show some kind of error message */
				if(ids.length > 0){
					// create the embed link
					var urlLink = "http://www.youtube.com/embed/" + ids[0].substring(3);
					// create the HTML
					var embed = '<img class="ta-insert-video" ta-insert-video="' + urlLink + '" contenteditable="false" src="" allowfullscreen="true" width="300" frameborder="0" height="250"/>';
					// insert
					return this.$editor().wrapSelection('insertHTML', embed, true);
				}
			}
		},
		onElementSelect: {
			element: 'img',
			onlyWithAttrs: ['ta-insert-video'],
			action: imgOnSelectAction
		}
	});	
	taRegisterTool('insertLink', {
		iconclass: 'fa fa-link',
		action: function(){
			var urlLink;
			urlLink = $window.prompt(taTranslations.insertLink, 'http://');
			if(urlLink && urlLink !== '' && urlLink !== 'http://'){
				return this.$editor().wrapSelection('createLink', urlLink, true);
			}
		},
		activeState: function(commonElement){
			if(commonElement) return commonElement[0].tagName === 'A';
			return false;
		},
		onElementSelect: {
			element: 'a',
			action: function(event, $element, editorScope){
				// setup the editor toolbar
				// Credit to the work at http://hackerwins.github.io/summernote/ for this editbar logic
				event.preventDefault();
				editorScope.displayElements.popover.css('width', '305px');
				var container = editorScope.displayElements.popoverContainer;
				container.empty();
				container.css('line-height', '28px');
				var link = angular.element('<a href="' + $element.attr('href') + '" target="_blank">' + $element.attr('href') + '</a>');
				link.css({
					'display': 'inline-block',
					'max-width': '200px',
					'overflow': 'hidden',
					'text-overflow': 'ellipsis',
					'white-space': 'nowrap',
					'vertical-align': 'middle'
				});
				container.append(link);
				var buttonGroup = angular.element('<div class="btn-group pull-right">');
				var reLinkButton = angular.element('<button type="button" class="btn btn-default btn-sm btn-small" tabindex="-1" unselectable="on"><i class="fa fa-edit icon-edit"></i></button>');
				reLinkButton.on('click', function(event){
					event.preventDefault();
					var urlLink = $window.prompt(taTranslations.insertLink, $element.attr('href'));
					if(urlLink && urlLink !== '' && urlLink !== 'http://'){
						$element.attr('href', urlLink);
						editorScope.updateTaBindtaTextElement();
					}
					editorScope.hidePopover();
				});
				buttonGroup.append(reLinkButton);
				var unLinkButton = angular.element('<button type="button" class="btn btn-default btn-sm btn-small" tabindex="-1" unselectable="on"><i class="fa fa-unlink icon-unlink"></i></button>');
				// directly before ths click event is fired a digest is fired off whereby the reference to $element is orphaned off
				unLinkButton.on('click', function(event){
					event.preventDefault();
					$element.replaceWith($element.contents());
					editorScope.updateTaBindtaTextElement();
					editorScope.hidePopover();
				});
				buttonGroup.append(unLinkButton);
				container.append(buttonGroup);
				editorScope.showPopover($element);
			}
		}
	});
}]);
