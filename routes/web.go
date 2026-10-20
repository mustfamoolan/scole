package routes

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

func RegisterWebRoutes(app *fiber.App) {
	// Serve static files from Vite build
	app.Static("/", "./public")

	// UI Showcase Route (Client-side handles this, but server must serve index.html)
	app.Get("/ui-showcase", func(c *fiber.Ctx) error {
		return c.SendFile("./public/index.html")
	})

	// Fallback to React for any other web routes (prevent serving HTML for API endpoints)
	app.Get("/*", func(c *fiber.Ctx) error {
		if strings.HasPrefix(c.Path(), "/api") {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "ROUTE_NOT_FOUND",
					"message": "API endpoint not found: " + c.Path(),
				},
			})
		}
		return c.SendFile("./public/index.html")
	})
}
