/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "@semajsx/dom";
import { inject } from "@semajsx/style";
import { Tabs, TabList, Tab, TabPanel } from "./tabs";
import { lightTheme } from "../../theme/themes";

describe("Tabs", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    inject(lightTheme);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders tab structure", () => {
    render(
      <Tabs defaultValue="a">
        <TabList>
          <Tab value="a">Tab A</Tab>
          <Tab value="b">Tab B</Tab>
        </TabList>
        <TabPanel value="a">Content A</TabPanel>
        <TabPanel value="b">Content B</TabPanel>
      </Tabs>,
      container,
    );

    const tabs = container.querySelectorAll("[role='tab']");
    expect(tabs.length).toBe(2);
    expect(tabs[0]!.textContent).toBe("Tab A");
    expect(tabs[1]!.textContent).toBe("Tab B");
  });

  it("renders all tab panels", () => {
    render(
      <Tabs defaultValue="a">
        <TabList>
          <Tab value="a">A</Tab>
          <Tab value="b">B</Tab>
        </TabList>
        <TabPanel value="a">Content A</TabPanel>
        <TabPanel value="b">Content B</TabPanel>
      </Tabs>,
      container,
    );

    const panels = container.querySelectorAll("[role='tabpanel']");
    expect(panels.length).toBe(2);
  });

  it("sets data-tabs attribute with default value", () => {
    render(
      <Tabs defaultValue="first">
        <TabList>
          <Tab value="first">First</Tab>
        </TabList>
        <TabPanel value="first">Content</TabPanel>
      </Tabs>,
      container,
    );

    const root = container.querySelector("[data-tabs]")!;
    expect(root.getAttribute("data-tabs")).toBe("first");
  });

  it("sets data-tab-value on tab triggers", () => {
    render(
      <Tabs defaultValue="x">
        <TabList>
          <Tab value="x">X</Tab>
          <Tab value="y">Y</Tab>
        </TabList>
        <TabPanel value="x">X content</TabPanel>
        <TabPanel value="y">Y content</TabPanel>
      </Tabs>,
      container,
    );

    const tab = container.querySelector("[data-tab-value='y']");
    expect(tab).toBeTruthy();
    expect(tab!.textContent).toBe("Y");
  });

  it("sets tablist role on tab list", () => {
    render(
      <Tabs defaultValue="a">
        <TabList>
          <Tab value="a">A</Tab>
        </TabList>
        <TabPanel value="a">Content</TabPanel>
      </Tabs>,
      container,
    );

    const list = container.querySelector("[role='tablist']");
    expect(list).toBeTruthy();
  });

  it("supports custom class on Tabs", () => {
    render(
      <Tabs defaultValue="a" class="custom-tabs">
        <TabList>
          <Tab value="a">A</Tab>
        </TabList>
        <TabPanel value="a">Content</TabPanel>
      </Tabs>,
      container,
    );

    const root = container.querySelector("[data-tabs]")!;
    expect(root.getAttribute("class")).toContain("custom-tabs");
  });
});
