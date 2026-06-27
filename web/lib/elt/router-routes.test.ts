import { describe, expect, it } from "vitest";
import {
  outputTableForRouterPort,
  parseRouterRouteRows,
  routerOutputPortsFromConfig,
  serializeRouterRoutes,
} from "@/lib/elt/router-routes";

describe("router-routes", () => {
  it("parses and serializes route rows", () => {
    const config = {
      routes: JSON.stringify([
        { condition: 'status = "active"', output_table: "staging.active" },
        { condition: 'status = "inactive"', output_table: "staging.inactive" },
      ]),
    };
    expect(parseRouterRouteRows(config)).toHaveLength(2);
    expect(serializeRouterRoutes(parseRouterRouteRows(config))).toContain("staging.active");
  });

  it("builds canvas output ports with stable ids", () => {
    const ports = routerOutputPortsFromConfig({
      routes: '[{"condition":"x > 1","output_table":"staging.big"}]',
      default_output_table: "staging.other",
    });
    expect(ports.map((p) => p.id)).toEqual(["route-0", "default"]);
    expect(outputTableForRouterPort(
      {
        routes: '[{"condition":"x > 1","output_table":"staging.big"}]',
        default_output_table: "staging.other",
      },
      "route-0"
    )).toBe("staging.big");
  });
});
