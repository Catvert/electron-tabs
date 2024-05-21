import Sortable from "sortablejs";
// @ts-ignore
import styles from "bundle-text:./style.css";

if (!document) {
  throw Error("electron-tabs module must be called in renderer process");
}

interface TabGroupOptions {
  closeButtonText: string,
  defaultTab: TabOptions | ((tabGroup: TabGroup) => TabOptions),
  newTabButton: boolean,
  newTabButtonText: string,
  sortable: boolean,
  sortableOptions?: Sortable.Options
  visibilityThreshold: number,
}

interface TabOptions {
  active?: boolean;
  badge?: Badge;
  closable?: boolean;
  icon?: string;
  iconURL?: string;
  ready?: ((tab: Tab) => void);
  src?: string;
  title?: string;
  visible?: boolean;
  webviewAttributes?: { [key: string]: any };
}

interface Badge {
  text: string,
  classname: string
}

const CLASSNAMES = {
  ROOT: "etabs",
  HEADER: "etabs-header",
  LEFTGROUP: "etabs-left-group",
  RIGHTGROUP: "etabs-right-group",
  SELECT: "etabs-select",
  NAV: "nav",
  TABS: "tabs",
  TAB: "tab",
  BUTTONS: "buttons",
  VIEWS: "views",
  VIEW: "view",
  ICONBTN: "icon-btn",
}

function emit(emitter: TabGroup | Tab, type: string, args: any[]) {
  if (type === "ready") {
    emitter.isReady = true;
  }
  emitter.dispatchEvent(new CustomEvent(type, { detail: args }));
}

function on(emitter: TabGroup | Tab, type: string, fn: (detail: string) => void, options?: { [key: string]: any }) {
  if (type === "ready" && emitter.isReady === true) {
    fn.apply(emitter, [emitter]);
  }
  emitter.addEventListener(type, ((e: CustomEvent) => fn.apply(emitter, e.detail)) as EventListener, options);
}

class TabGroup extends HTMLElement {
  buttonContainer: HTMLDivElement;
  isReady: boolean;
  newTabId: number;
  options: TabGroupOptions;
  shadow: ShadowRoot;
  tabContainer: HTMLDivElement;
  tabs: Array<Tab>;
  viewContainer: HTMLDivElement;
  rightGroupSelect: HTMLSelectElement;

  constructor() {
    super();

    this.isReady = false;

    // Options
    this.options = {
      closeButtonText: this.getAttribute("close-button-text") || "&#215;",
      defaultTab: { title: "New Tab", active: true },
      newTabButton: !!this.getAttribute("new-tab-button") === true || false,
      newTabButtonText: this.getAttribute("new-tab-button-text") || "&#65291;",
      sortable: !!this.getAttribute("sortable") === true || false,
      visibilityThreshold: Number(this.getAttribute("visibility-threshold")) || 0,
    };

    this.tabs = [];
    this.newTabId = 0;

    this.createComponent();
    this.initVisibility();
    if (this.options.sortable) {
      this.initSortable();
    }

    this.emit("ready", this);
  }

  emit(type: string, ...args: any[]) {
    return emit(this, type, args);
  }

  on(type: string, fn: (...detail: any[]) => void) {
    return on(this, type, fn);
  }

  once(type: string, fn: (detail: string) => void) {
    return on(this, type, fn, { once: true });
  }

  connectedCallback() {
    // Support custom styles
    const style = this.querySelector("style");
    if (style) {
      this.shadow.appendChild(style);
    }
  }

  private createComponent() {
    const shadow = this.attachShadow({mode: "open"});
    this.shadow = shadow;

    const wrapper = document.createElement("div");
    wrapper.setAttribute("class", CLASSNAMES.ROOT);

    const header = document.createElement("div");
    header.setAttribute("class", CLASSNAMES.HEADER);
    wrapper.appendChild(header);

    const leftGroup = document.createElement("div");
    leftGroup.setAttribute("class", CLASSNAMES.LEFTGROUP);
    header.appendChild(leftGroup);

    const leftButtonContainer = document.createElement("div");
    leftButtonContainer.setAttribute("class", CLASSNAMES.BUTTONS);
    leftGroup.appendChild(leftButtonContainer);

    const previousButton = leftButtonContainer.appendChild(document.createElement("button"));
    previousButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="m7.85 13l2.85 2.85q.3.3.288.7t-.288.7q-.3.3-.712.313t-.713-.288L4.7 12.7q-.3-.3-.3-.7t.3-.7l4.575-4.575q.3-.3.713-.287t.712.312q.275.3.288.7t-.288.7L7.85 11H19q.425 0 .713.288T20 12t-.288.713T19 13z"/></svg>
    `;
    previousButton.addEventListener("click", () => {
      const activeTab = this.getActiveTab();
      if (activeTab) {
        activeTab.webview.goBack();
      }
    }, false);

    const nextButton = leftButtonContainer.appendChild(document.createElement("button"));
    nextButton.setAttribute("class", CLASSNAMES.BUTTONS);
    nextButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M16.15 13H5q-.425 0-.712-.288T4 12t.288-.712T5 11h11.15L13.3 8.15q-.3-.3-.288-.7t.288-.7q.3-.3.713-.312t.712.287L19.3 11.3q.15.15.213.325t.062.375t-.062.375t-.213.325l-4.575 4.575q-.3.3-.712.288t-.713-.313q-.275-.3-.288-.7t.288-.7z"/></svg>
    `;
    nextButton.addEventListener("click", () => {
      const activeTab = this.getActiveTab();
      if (activeTab) {
        activeTab.webview.goForward();
      }
    }, false);

    const refreshButton = leftButtonContainer.appendChild(document.createElement("button"));
    refreshButton.setAttribute("class", CLASSNAMES.BUTTONS);
    refreshButton.setAttribute("style", "margin-left: 16px;");
    refreshButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M6 12.05q0 1.125.425 2.188T7.75 16.2l.25.25V15q0-.425.288-.712T9 14t.713.288T10 15v4q0 .425-.288.713T9 20H5q-.425 0-.712-.288T4 19t.288-.712T5 18h1.75l-.4-.35q-1.3-1.15-1.825-2.625T4 12.05Q4 9.7 5.2 7.787T8.425 4.85q.35-.2.738-.025t.512.575q.125.375-.012.75t-.488.575q-1.45.8-2.312 2.213T6 12.05m12-.1q0-1.125-.425-2.187T16.25 7.8L16 7.55V9q0 .425-.288.713T15 10t-.712-.288T14 9V5q0-.425.288-.712T15 4h4q.425 0 .713.288T20 5t-.288.713T19 6h-1.75l.4.35q1.225 1.225 1.788 2.663T20 11.95q0 2.35-1.2 4.263t-3.225 2.937q-.35.2-.737.025t-.513-.575q-.125-.375.013-.75t.487-.575q1.45-.8 2.313-2.212T18 11.95"/></svg>
    `;
    refreshButton.addEventListener("click", () => {
      const activeTab = this.getActiveTab();
      if (activeTab) {
        activeTab.webview.reload();
      }
    }, false);

    const rightGroup = document.createElement("div");
    rightGroup.setAttribute("class", CLASSNAMES.RIGHTGROUP);
    header.appendChild(rightGroup);

    const unzoomButton = rightGroup.appendChild(document.createElement("span"));
    unzoomButton.setAttribute("class", CLASSNAMES.ICONBTN);
    unzoomButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 10h6m2 5l6 6m-11-4a7 7 0 1 1 0-14a7 7 0 0 1 0 14"/></svg>
    `;
    unzoomButton.addEventListener("click", () => {
      const activeTab = this.getActiveTab();
      if (activeTab) {
        activeTab.webview.setZoomLevel(activeTab.webview.getZoomLevel() - 0.1);
      }
    }, false);

    const zoomButton = rightGroup.appendChild(document.createElement("span"));
    zoomButton.setAttribute("class", CLASSNAMES.ICONBTN);
    zoomButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 10h3m0 0h3m-3 0V7m0 3v3m5 2l6 6m-11-4a7 7 0 1 1 0-14a7 7 0 0 1 0 14"/></svg>
    `;
    zoomButton.addEventListener("click", () => {
      const activeTab = this.getActiveTab();
      if (activeTab) {
        activeTab.webview.setZoomLevel(activeTab.webview.getZoomLevel() + 0.1);
      }
    }, false);

    const selectContainer = document.createElement("div");
    selectContainer.setAttribute("class", CLASSNAMES.SELECT);
    rightGroup.appendChild(selectContainer);
    const select = selectContainer.appendChild(document.createElement("select"));
    select.addEventListener("change", (e) => this.emit("right-select-changed", e.target.value, this), false);
    this.rightGroupSelect = select;

    const tabgroup = document.createElement("nav");
    tabgroup.setAttribute("class", CLASSNAMES.NAV);
    leftGroup.appendChild(tabgroup);

    const tabContainer = document.createElement("div");
    tabContainer.setAttribute("class", CLASSNAMES.TABS);
    tabgroup.appendChild(tabContainer);
    this.tabContainer = tabContainer;

    const buttonContainer = document.createElement("div");
    buttonContainer.setAttribute("class", CLASSNAMES.BUTTONS);
    tabgroup.appendChild(buttonContainer);
    this.buttonContainer = buttonContainer;

    if (this.options.newTabButton) {
      const button = this.buttonContainer.appendChild(document.createElement("button"));
      button.innerHTML = this.options.newTabButtonText;
      button.addEventListener("click", this.addTab.bind(this, undefined), false);
    }

    const viewContainer = document.createElement("div");
    viewContainer.setAttribute("class", CLASSNAMES.VIEWS);
    wrapper.appendChild(viewContainer);
    this.viewContainer = viewContainer;

    const style = document.createElement("style");
    style.textContent = styles;

    shadow.appendChild(style);
    shadow.appendChild(wrapper);
  }

  private initVisibility() {
    function toggleTabsVisibility(tab: Tab, tabGroup: TabGroup) {
      const visibilityThreshold = tabGroup.options.visibilityThreshold;
      const el = tabGroup.tabContainer.parentElement;
      if (tabGroup.tabs.length >= visibilityThreshold) {
        el.classList.add("visible");
      } else {
        el.classList.remove("visible");
      }
    }

    this.on("tab-added", toggleTabsVisibility);
    this.on("tab-removed", toggleTabsVisibility);
    toggleTabsVisibility(null, this);
  }

  initSortable() {
    const createNewSortable = () => {
      const options = Object.assign({
        direction: "horizontal",
        animation: 150,
        swapThreshold: 0.20
      }, this.options.sortableOptions);
      new Sortable(this.tabContainer, options);
    };

    if (Sortable) {
      createNewSortable();
    } else {
      document.addEventListener("DOMContentLoaded", createNewSortable);
    }
  }

  setDefaultTab(tab: TabOptions) {
    this.options.defaultTab = tab;
  }

  setRightGroupSelectOptions(options: Array<{ value: string, text: string, selected: boolean }>) {
    const select = this.rightGroupSelect;
    select.innerHTML = "";

    for (let i in options) {
      const option = select.appendChild(document.createElement("option"));
      option.value = options[i].value;
      option.selected = options[i].selected;
      option.innerHTML = options[i].text;
    }
  }

  addTab(args = this.options.defaultTab) {
    if (typeof args === "function") {
      args = args(this);
    }
    const id = this.newTabId;
    this.newTabId++;
    const tab = new Tab(this, id, args);
    this.tabs.push(tab);
    // Don't call tab.activate() before a tab is referenced in this.tabs
    if (args.active === true) {
      tab.activate();
    }
    this.emit("tab-added", tab, this);
    return tab;
  }

  getTab(id: number) {
    for (let i in this.tabs) {
      if (this.tabs[i].id === id) {
        return this.tabs[i];
      }
    }
    return null;
  }

  getTabByPosition(position: number) {
    const fromRight = position < 0;
    for (let i in this.tabs) {
      if (this.tabs[i].getPosition(fromRight) === position) {
        return this.tabs[i];
      }
    }
    return null;
  }

  getTabByRelPosition(position: number) {
    position = this.getActiveTab().getPosition() + position;
    if (position < 0) {
      return null;
    }
    return this.getTabByPosition(position);
  }

  getNextTab() {
    return this.getTabByRelPosition(1);
  }

  getPreviousTab() {
    return this.getTabByRelPosition(-1);
  }

  getTabs() {
    return this.tabs.slice();
  }

  eachTab(fn: (tab: Tab) => void) {
    this.getTabs().forEach(fn);
  }

  getActiveTab() {
    if (this.tabs.length === 0) return null;
    return this.tabs[0];
  }

  setActiveTab(tab: Tab) {
    this.removeTab(tab);
    this.tabs.unshift(tab);
    this.emit("tab-active", tab, this);
  }

  removeTab(tab: Tab, triggerEvent = false) {
    const id = tab.id;
    const index = this.tabs.findIndex((t: Tab) => t.id === id);
    this.tabs.splice(index, 1);
    if (triggerEvent) {
      this.emit("tab-removed", tab, this);
    }
  }

  activateRecentTab() {
    if (this.tabs.length > 0) {
      this.tabs[0].activate();
    }
  }
}

class Tab extends EventTarget {
  badge: Badge;
  closable: boolean;
  element: HTMLDivElement;
  icon: string;
  iconURL: string;
  id: number;
  isClosed: boolean;
  isReady: boolean;
  spans: { [key: string]: HTMLSpanElement };
  tabGroup: TabGroup;
  title: string;
  webview: HTMLElement;
  webviewAttributes: { [key: string]: any };

  constructor(tabGroup: TabGroup, id: number, args: TabOptions) {
    super();
    this.badge = args.badge;
    this.closable = args.closable === false ? false : true;
    this.icon = args.icon;
    this.iconURL = args.iconURL;
    this.id = id;
    this.isClosed = false;
    this.isReady = false;
    this.spans = {};
    this.tabGroup = tabGroup;
    this.title = args.title;
    this.webviewAttributes = args.webviewAttributes || {};
    this.webviewAttributes.src = args.src;

    this.initTab();
    this.initWebview();

    if (args.visible !== false) {
      this.show();
    }
    if (typeof args.ready === "function") {
      args.ready(this);
    } else {
      this.emit("ready", this);
    }
  }

  emit(type: string, ...args: any[]) {
    return emit(this, type, args);
  }

  on(type: string, fn: (...detail: any[]) => void) {
    return on(this, type, fn);
  }

  once(type: string, fn: (detail: string) => void) {
    return on(this, type, fn, { once: true });
  }

  private initTab() {
    const tab = this.element = document.createElement("div");
    tab.classList.add(CLASSNAMES.TAB);
    for (let el of ["icon", "title", "badge", "close"]) {
      const span = tab.appendChild(document.createElement("span"));
      span.classList.add(`${CLASSNAMES.TAB}-${el}`);
      this.spans[el] = span;
    }

    this.setTitle(this.title);
    this.setBadge(this.badge);
    this.setIcon(this.iconURL, this.icon);
    this.initTabCloseButton();
    this.initTabClickHandler();

    this.tabGroup.tabContainer.appendChild(this.element);
  }

  private initTabCloseButton() {
    const container = this.spans.close;
    if (this.closable) {
      const button = container.appendChild(document.createElement("button"));
      button.innerHTML = this.tabGroup.options.closeButtonText;
      button.addEventListener("click", this.close.bind(this, false), false);
    }
  }

  private initTabClickHandler() {
    // Mouse up
    const tabClickHandler = function(e: KeyboardEvent) {
      if (this.isClosed) return;
      if (e.which === 2) {
        this.close();
      }
    };
    this.element.addEventListener("mouseup", tabClickHandler.bind(this), false);
    // Mouse down
    const tabMouseDownHandler = function(e: KeyboardEvent) {
      if (this.isClosed) return;
      if (e.which === 1) {
        if ((e.target as HTMLElement).matches("button")) return;
        this.activate();
      }
    };
    this.element.addEventListener("mousedown", tabMouseDownHandler.bind(this), false);
  }

  initWebview() {
    const webview = this.webview = document.createElement("webview");

    const tabWebviewDidFinishLoadHandler = function(e: Event) {
      this.emit("webview-ready", this);
    };

    this.webview.addEventListener("did-finish-load", tabWebviewDidFinishLoadHandler.bind(this), false);

    const tabWebviewDomReadyHandler = function(e: Event) {
      // Remove this once https://github.com/electron/electron/issues/14474 is fixed
      webview.blur();
      webview.focus();
      this.emit("webview-dom-ready", this);
    };

    this.webview.addEventListener("dom-ready", tabWebviewDomReadyHandler.bind(this), false);

    this.webview.classList.add(CLASSNAMES.VIEW);
    if (this.webviewAttributes) {
      const attrs = this.webviewAttributes;
      for (let key in attrs) {
        const attr = attrs[key];
        if (attr === false) continue;
        this.webview.setAttribute(key, attr);
      }
    }

    this.tabGroup.viewContainer.appendChild(this.webview);
  }

  setTitle(title: string) {
    if (this.isClosed) return;
    const span = this.spans.title;
    span.innerHTML = title;
    span.title = title;
    this.title = title;
    this.emit("title-changed", title, this);
    return this;
  }

  getTitle() {
    if (this.isClosed) return;
    return this.title;
  }

  setBadge(badge?: Badge) {
    if (this.isClosed) return;
    const span = this.spans.badge;
    this.badge = badge;

    if (badge) {
      span.innerHTML = badge.text;
      span.classList.add(badge.classname);
      span.classList.remove("hidden");
    } else {
      span.classList.add("hidden");
    }

    this.emit("badge-changed", badge, this);
  }

  getBadge() {
    if (this.isClosed) return;
    return this.badge;
  }

  setIcon(iconURL: string, icon: string) {
    if (this.isClosed) return;
    this.iconURL = iconURL;
    this.icon = icon;
    const span = this.spans.icon;
    if (iconURL) {
      span.innerHTML = `<img src="${iconURL}" />`;
      this.emit("icon-changed", iconURL, this);
    } else if (icon) {
      span.innerHTML = `<i class="${icon}"></i>`;
      this.emit("icon-changed", icon, this);
    }

    return this;
  }

  getIcon() {
    if (this.isClosed) return;
    if (this.iconURL) return this.iconURL;
    return this.icon;
  }

  setPosition(newPosition: number) {
    const tabContainer = this.tabGroup.tabContainer;
    const length = tabContainer.childElementCount;
    const thisPosition = this.getPosition();
    const tabs = Array.from(tabContainer.children)
    tabs.splice(thisPosition, 1);

    if (newPosition < 0) {
      newPosition += length;
      if (newPosition < 0) {
        newPosition = 0;
      }
    }

    if (newPosition < length) {
      tabContainer.insertBefore(this.element, tabs[newPosition]);
    } else {
      tabContainer.appendChild(this.element);
    }

    return this;
  }

  getPosition(fromRight = false) {
    let position = 0;
    let tab = this.element;
    while ((tab = tab.previousSibling as HTMLDivElement) != null) position++;

    if (fromRight === true) {
      position -= this.tabGroup.tabContainer.childElementCount;
    }

    return position;
  }

  activate() {
    if (this.isClosed) return;
    const activeTab = this.tabGroup.getActiveTab();
    if (activeTab) {
      activeTab.element.classList.remove("active");
      activeTab.webview.classList.remove("visible");
      activeTab.emit("inactive", activeTab);
    }
    this.tabGroup.setActiveTab(this);
    this.element.classList.add("active");
    this.webview.classList.add("visible");
    this.webview.focus();
    this.emit("active", this);
    return this;
  }

  show(flag = true) {
    if (this.isClosed) return;
    if (flag) {
      this.element.classList.add("visible");
      this.emit("visible", this);
    } else {
      this.element.classList.remove("visible");
      this.emit("hidden", this);
    }
    return this;
  }

  hide() {
    return this.show(false);
  }

  hasClass(classname: string) {
    return this.element.classList.contains(classname);
  }

  close(force: boolean) {
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    this.emit("closing", this, abort);

    const abortSignal = abortController.signal;
    if (this.isClosed || (!this.closable && !force) || abortSignal.aborted) return;

    this.isClosed = true;
    const tabGroup = this.tabGroup;
    tabGroup.tabContainer.removeChild(this.element);
    tabGroup.viewContainer.removeChild(this.webview);
    const activeTab = this.tabGroup.getActiveTab();
    tabGroup.removeTab(this, true);

    this.emit("close", this);

    if (activeTab.id === this.id) {
      tabGroup.activateRecentTab();
    }
  }
}

customElements.define("tab-group", TabGroup);

export type { TabGroup, Tab };
