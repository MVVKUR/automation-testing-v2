import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; AutoTestAI/1.0)',
      },
    });

    const contentType = response.headers.get('content-type') || 'text/html';
    const body = await response.text();

    // Parse the URL for path and origin
    const originalUrl = new URL(url);
    const originalPath = originalUrl.pathname + originalUrl.search + originalUrl.hash;
    const baseOrigin = originalUrl.origin;

    // Script 1: URL fix - runs IMMEDIATELY before React loads
    // This must run before any other scripts to fix the URL for SPA routing
    const urlFixScript = `
<script>
  // AutoTest AI - Fix URL for SPA routing (runs before React)
  (function() {
    var originalPath = '${originalPath}';
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', originalPath);
      console.log('[AutoTest AI] URL set to:', originalPath);
    }
  })();
</script>`;

    // Script 2: Bridge - runs after DOM is ready
    const bridgeScript = `
<script>
  // AutoTest AI - Real-time Test Execution Bridge
  (function() {
    console.log('[AutoTest AI] Bridge script loaded');

    // Helper to set value on React-controlled inputs
    function setNativeValue(element, value) {
      var valueSetter = Object.getOwnPropertyDescriptor(element, 'value');
      var protoSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');

      if (valueSetter && protoSetter && valueSetter.set !== protoSetter.set) {
        protoSetter.set.call(element, value);
      } else if (valueSetter && valueSetter.set) {
        valueSetter.set.call(element, value);
      } else {
        element.value = value;
      }
    }

    // Helper to wait for element with retry
    function waitForElement(selector, timeout, callback) {
      var startTime = Date.now();
      var checkElement = function() {
        var element = document.querySelector(selector);
        if (element) {
          callback(null, element);
        } else if (Date.now() - startTime > timeout) {
          callback('Element not found: ' + selector, null);
        } else {
          setTimeout(checkElement, 100);
        }
      };
      checkElement();
    }

    // Listen for test commands from parent
    window.addEventListener('message', function(event) {
      if (!event.data || event.data.type !== 'AUTOTEST_ACTION') return;

      var action = event.data.action;
      var selector = event.data.selector;
      var value = event.data.value;
      var timeout = event.data.timeout || 5000;

      console.log('[AutoTest AI] Action:', action, selector, value);

      try {
        if (action === 'type') {
          waitForElement(selector, timeout, function(err, element) {
            if (err) {
              console.error('[AutoTest AI]', err);
              window.parent.postMessage({ type: 'AUTOTEST_RESULT', success: false, error: err }, '*');
              return;
            }
            element.focus();
            setNativeValue(element, '');
            element.dispatchEvent(new Event('input', { bubbles: true }));

            var currentValue = '';
            var index = 0;
            var typeChar = function() {
              if (index < value.length) {
                currentValue += value[index];
                setNativeValue(element, currentValue);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                index++;
                setTimeout(typeChar, 30);
              } else {
                element.dispatchEvent(new Event('change', { bubbles: true }));
                element.dispatchEvent(new Event('blur', { bubbles: true }));
                window.parent.postMessage({
                  type: 'AUTOTEST_RESULT',
                  success: true,
                  action: action,
                  finalValue: element.value
                }, '*');
              }
            };
            typeChar();
          });
        } else if (action === 'click') {
          waitForElement(selector, timeout, function(err, el) {
            if (err) {
              window.parent.postMessage({ type: 'AUTOTEST_RESULT', success: false, error: err }, '*');
              return;
            }
            el.style.outline = '3px solid #3b82f6';
            setTimeout(function() {
              el.style.outline = '';
              el.click();
              window.parent.postMessage({ type: 'AUTOTEST_RESULT', success: true, action: action }, '*');
            }, 200);
          });
        } else if (action === 'clear') {
          waitForElement(selector, timeout, function(err, clearEl) {
            if (err) {
              window.parent.postMessage({ type: 'AUTOTEST_RESULT', success: false, error: err }, '*');
              return;
            }
            setNativeValue(clearEl, '');
            clearEl.dispatchEvent(new Event('input', { bubbles: true }));
            window.parent.postMessage({ type: 'AUTOTEST_RESULT', success: true, action: action }, '*');
          });
        } else if (action === 'verify') {
          // Verify element exists and is visible
          waitForElement(selector, timeout, function(err, verifyEl) {
            if (err) {
              window.parent.postMessage({ type: 'AUTOTEST_RESULT', success: false, error: err }, '*');
              return;
            }
            var isVisible = verifyEl.offsetWidth > 0 && verifyEl.offsetHeight > 0;
            window.parent.postMessage({
              type: 'AUTOTEST_RESULT',
              success: isVisible,
              action: action,
              error: isVisible ? null : 'Element not visible'
            }, '*');
          });
        }
      } catch (err) {
        console.error('[AutoTest AI] Error:', err);
        window.parent.postMessage({
          type: 'AUTOTEST_RESULT',
          success: false,
          error: err.message
        }, '*');
      }
    });

    // Wait for DOM ready, then notify parent
    function notifyReady() {
      window.parent.postMessage({ type: 'AUTOTEST_BRIDGE_READY' }, '*');
      console.log('[AutoTest AI] Bridge ready');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', notifyReady);
    } else {
      // Give React/Vue apps a moment to hydrate
      setTimeout(notifyReady, 500);
    }
  })();
</script>`;

    // Build modified HTML
    let modifiedBody = body;

    // 1. Add base tag right after <head>
    if (!modifiedBody.includes('<base')) {
      modifiedBody = modifiedBody.replace(
        '<head>',
        `<head><base href="${baseOrigin}/">`
      );
    }

    // 2. Inject URL fix script RIGHT AFTER <head> (before any other scripts)
    modifiedBody = modifiedBody.replace(
      '<head>',
      '<head>' + urlFixScript
    );

    // 3. Inject bridge script before </body> (runs after DOM ready)
    if (modifiedBody.includes('</body>')) {
      modifiedBody = modifiedBody.replace('</body>', bridgeScript + '</body>');
    } else {
      modifiedBody = modifiedBody + bridgeScript;
    }

    // 4. Rewrite relative URLs to absolute URLs
    modifiedBody = modifiedBody.replace(
      /(src|href)=["']\/(?!\/)/g,
      `$1="${baseOrigin}/`
    );

    return new NextResponse(modifiedBody, {
      headers: {
        'Content-Type': contentType,
        'X-Frame-Options': 'SAMEORIGIN',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch URL', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    const body = await request.text();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/json',
      },
      body,
    });

    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('Proxy POST error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request' },
      { status: 500 }
    );
  }
}
