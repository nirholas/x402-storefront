/**
 * Per-route request/response contracts published inside the x402 402 challenge.
 *
 * GENERATED FROM `public/openapi.json` — do not hand-edit. Run `npm run schemas`
 * after changing the OpenAPI document so the runtime challenge and the published
 * metadata cannot drift apart.
 *
 * The x402scan discovery spec requires every `accepts[]` entry to carry
 * `outputSchema.input` and `outputSchema.output`. Together they are how an agent
 * calls a route it has never seen before: `input` describes the request in the
 * x402 Bazaar `type: "http"` shape, and `output` is the JSON Schema of the 200
 * body the agent receives once it has paid. All `$ref`s are inlined, since a
 * client reading the challenge has not fetched the OpenAPI document.
 *
 * Keys match the paywall route map exactly:
 *   GET /buy/:sku
 */

/** One paid route's published request/response contract. */
export interface RouteSchema {
  /** How to call the route: method, path/query parameters or JSON body fields. */
  input: Record<string, unknown>;
  /** JSON Schema of the 200 response body. */
  output: Record<string, unknown>;
}

export const ROUTE_SCHEMAS: Record<string, RouteSchema> = {
  "GET /buy/:sku": {
    "input": {
      "type": "http",
      "method": "GET",
      "pathParams": {
        "sku": {
          "type": "string"
        }
      },
      "queryParams": {
        "name": {
          "type": "string",
          "description": "Shipping name (physical items)"
        },
        "address": {
          "type": "string",
          "description": "Shipping address (physical items)"
        },
        "country": {
          "type": "string",
          "description": "Shipping country (physical items)"
        }
      }
    },
    "output": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "payload": {
              "type": "object",
              "properties": {
                "orderId": {
                  "type": "string"
                },
                "sku": {
                  "type": "string"
                },
                "item": {
                  "type": "string"
                },
                "kind": {
                  "type": "string",
                  "const": "digital"
                },
                "downloadUrl": {
                  "type": "string"
                },
                "downloadExpiresAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "contentType": {
                  "type": "string"
                },
                "contentSha256": {
                  "type": "string"
                },
                "license": {
                  "type": "string"
                },
                "purchasedAt": {
                  "type": "string",
                  "format": "date-time"
                }
              },
              "required": [
                "orderId",
                "sku",
                "kind",
                "downloadUrl",
                "downloadExpiresAt",
                "contentSha256"
              ]
            },
            "signature": {
              "type": "string"
            },
            "algorithm": {
              "type": "string",
              "const": "HMAC-SHA256"
            },
            "canonicalization": {
              "type": "string"
            }
          },
          "required": [
            "payload",
            "signature",
            "algorithm"
          ]
        },
        {
          "type": "object",
          "properties": {
            "payload": {
              "type": "object",
              "properties": {
                "orderId": {
                  "type": "string"
                },
                "sku": {
                  "type": "string"
                },
                "item": {
                  "type": "string"
                },
                "kind": {
                  "type": "string",
                  "const": "physical"
                },
                "fulfillment": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string",
                      "const": "accepted"
                    },
                    "promise": {
                      "type": "string"
                    },
                    "shipTo": {
                      "type": "object",
                      "properties": {
                        "name": {
                          "type": "string"
                        },
                        "address": {
                          "type": "string"
                        },
                        "country": {
                          "type": "string"
                        }
                      }
                    },
                    "weightGrams": {
                      "type": "number"
                    }
                  }
                },
                "supportEmail": {
                  "type": "string"
                },
                "purchasedAt": {
                  "type": "string",
                  "format": "date-time"
                }
              },
              "required": [
                "orderId",
                "sku",
                "kind",
                "fulfillment"
              ]
            },
            "signature": {
              "type": "string"
            },
            "algorithm": {
              "type": "string",
              "const": "HMAC-SHA256"
            },
            "canonicalization": {
              "type": "string"
            }
          },
          "required": [
            "payload",
            "signature",
            "algorithm"
          ]
        }
      ]
    }
  }
};
