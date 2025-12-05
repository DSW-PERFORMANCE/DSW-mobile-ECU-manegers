/* dashboard-scale.js
   Updated approach: instead of using CSS transform:scale on the .dashboard-stage,
   we compute a pixel width/height for the stage that fits the available container
   while preserving the design aspect ratio. This avoids issues with child
   element sizing and keeps SVG/needle rendering stable.
*/
(function () {
    function updateScales() {
        document.querySelectorAll('.dashboard-stage').forEach(stage => {
            const container = stage.parentElement || stage.parentNode;
            if (!container) return;
            const parentRect = container.getBoundingClientRect();

            // design W/H from dataset or CSS var
            let designW = parseInt(stage.dataset.designWidth) || parseInt(getComputedStyle(document.documentElement).getPropertyValue('--dashboard-design-width')) || 500;
            let designH = parseInt(stage.dataset.designHeight) || parseInt(getComputedStyle(document.documentElement).getPropertyValue('--dashboard-design-height')) || 500;

            // compute scale to fit inside parent while preserving aspect ratio
            const scaleX = parentRect.width / designW;
            const scaleY = parentRect.height / designH;
            const scale = Math.min(scaleX, scaleY) || 1;

            // set CSS var for potential usage by widgets
            stage.style.setProperty('--dashboard-scale', scale);

            // Instead of transform scale, set the computed pixel size for the stage.
            const stageW = Math.round(designW * scale);
            const stageH = Math.round(designH * scale);
            stage.style.width = stageW + 'px';
            stage.style.height = stageH + 'px';

            // center the stage within its parent
            stage.style.left = '50%';
            stage.style.top = '50%';
            stage.style.transform = 'translate(-50%, -50%)';
            stage.style.transformOrigin = '50% 50%';
        });
    }

    window.addEventListener('DOMContentLoaded', () => setTimeout(updateScales, 10));
    window.addEventListener('resize', updateScales);

    const observer = new MutationObserver(() => updateScales());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    window.dashboardScale = { update: updateScales };
})();
