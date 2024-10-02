import { apiInitializer } from "discourse/lib/api";
import loadScript from "discourse/lib/load-script";
import discourseDebounce from "discourse-common/lib/debounce";
import Yaml from "js-yaml";

async function applyPlotly(element, key = "composer") {
  const plotlys = element.querySelectorAll("pre[data-code-wrap=plotly]");

  if (!plotlys.length) {
    return;
  }

  await loadScript(settings.theme_uploads_local.plotly_js);

/*
  window.Plotly.initialize({
    startOnLoad: false,
    theme:
      getComputedStyle(document.body)
        .getPropertyValue("--scheme-type")
        .trim() === "dark"
        ? "dark"
        : "default",
  });
 */

  plotlys.forEach((plotly) => {
    if (plotly.dataset.processed) {
      return;
    }

    const spinner = document.createElement("div");
    spinner.classList.add("spinner");

    plotly.append(spinner);
  });

  plotlys.forEach((plotly, index) => {
    const code = plotly.querySelector("code");

    if (!code) {
      return;
    }

    const plotlyId = `plotly_${index}_${key}`;

    try {
        const plotlydata = Yaml.load(code.textContent);
        if (!plotlydata.layout) {
            plotlydata.layout = {};
        }
        if (!plotlydata.layout.height || plotlydata.layout.height > 450) {
            plotlydata.layout.height = 450;
        }
        if (!plotlydata.layout.width || plotlydata.layout.width > 650) {
            plotlydata.layout.width = 650;
        }
        plotly.innerHTML = `<div id="${plotlyId}"></div>`;
        const promise = window.Plotly.newPlot(plotlyId, plotlydata.data || [], plotlydata.layout || {});
        promise
          .finally(() => {
            plotly.dataset.processed = true;
            var clientHeight = plotlydata.layout.height;
            if (clientHeight && key !== "composer") {
                plotly.style.height = `${clientHeight}px`;
            }
          });
    } catch (e) {
        plotly.innerText = e?.message || e;
        plotly.dataset.processed = true;
        plotly.querySelector(".spinner")?.remove();
        return;
    }
  });
}

export default apiInitializer("1.13.0", (api) => {
  // this is a hack as applySurround expects a top level
  // composer key, not possible from a theme
  window.I18n.translations[
    window.I18n.locale
  ].js.composer.plotly_sample = `data:
        - x: [1, 2, 3]
          y: [10, 40, 90]
          type: scatter`;

  api.addComposerToolbarPopupMenuOption({
    icon: "project-diagram",
    label: themePrefix("insert_plotly_sample"),
    action: (toolbarEvent) => {
      toolbarEvent.applySurround(
        "\n```plotly\n",
        "\n```\n",
        "plotly_sample",
        { multiline: false }
      );
    },
  });

  if (api.decorateChatMessage) {
    api.decorateChatMessage((element) => {
      applyPlotly(element, `chat_message_${element.id}`);
    });
  }

  api.decorateCookedElement(
    async (elem, helper) => {
      const id = helper ? `post_${helper.getModel().id}` : "composer";
      applyPlotly(elem, id);
    },
    { id: "discourse-plotly-theme-component" }
  );
});
