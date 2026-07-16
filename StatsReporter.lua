--[[
  StatsReporter.lua
  Place this as a Script inside ServerScriptService.

  What it does:
  - Sends a player's currency/level/inventory to your dashboard backend
    whenever those values change, plus a periodic heartbeat as a safety net.
  - Tells the backend when a player leaves.

  Setup:
  1. Enable HTTP requests: Game Settings > Security > Allow HTTP Requests.
  2. Replace API_URL below with your deployed backend's URL (not localhost --
     Roblox's servers run in the cloud and can't reach your laptop directly.
     See the "Getting this online" notes at the bottom of this file).
  3. Replace API_KEY with the same value you set as DASHBOARD_API_KEY on the server.
  4. Adjust the paths below (leaderstats names, inventory source) to match
     how your game actually stores currency/level/inventory.
]]

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local API_URL = "https://your-backend-url.com" -- CHANGE ME
local API_KEY = "change-me-please"              -- CHANGE ME (must match server)
local HEARTBEAT_INTERVAL = 30                    -- seconds, safety-net sync

local function post(path, body)
    local ok, result = pcall(function()
        return HttpService:PostAsync(
            API_URL .. path,
            HttpService:JSONEncode(body),
            Enum.HttpContentType.ApplicationJson,
            false,
            { ["x-api-key"] = API_KEY }
        )
    end)
    if not ok then
        warn("[StatsReporter] request to " .. path .. " failed: " .. tostring(result))
    end
    return ok
end

-- Adjust this to however your game actually tracks player data.
-- This example assumes leaderstats (Currency, Level) + an "Inventory" folder of tools/items.
local function getPlayerSnapshot(player)
    local leaderstats = player:FindFirstChild("leaderstats")
    local currency = leaderstats and leaderstats:FindFirstChild("Currency")
    local level = leaderstats and leaderstats:FindFirstChild("Level")

    local inventory = {}
    local invFolder = player:FindFirstChild("Inventory")
    if invFolder then
        for _, item in ipairs(invFolder:GetChildren()) do
            table.insert(inventory, item.Name)
        end
    end

    return {
        userId = player.UserId,
        username = player.Name,
        currency = currency and currency.Value or 0,
        level = level and level.Value or 1,
        inventory = inventory
    }
end

local function reportPlayer(player)
    local snapshot = getPlayerSnapshot(player)
    post("/api/player-update", snapshot)
end

Players.PlayerAdded:Connect(function(player)
    -- Send an initial snapshot once leaderstats exist.
    player:WaitForChild("leaderstats", 10)
    reportPlayer(player)

    -- Re-report whenever tracked stats change, so the dashboard updates live.
    local leaderstats = player:FindFirstChild("leaderstats")
    if leaderstats then
        for _, stat in ipairs(leaderstats:GetChildren()) do
            stat:GetPropertyChangedSignal("Value"):Connect(function()
                reportPlayer(player)
            end)
        end
    end

    local invFolder = player:FindFirstChild("Inventory")
    if invFolder then
        invFolder.ChildAdded:Connect(function() reportPlayer(player) end)
        invFolder.ChildRemoved:Connect(function() reportPlayer(player) end)
    end
end)

Players.PlayerRemoving:Connect(function(player)
    post("/api/player-left", { userId = player.UserId })
end)

-- Safety-net heartbeat in case a signal is missed.
task.spawn(function()
    while true do
        task.wait(HEARTBEAT_INTERVAL)
        for _, player in ipairs(Players:GetPlayers()) do
            reportPlayer(player)
        end
    end
end)

--[[
  Getting this online:
  Roblox game servers can't reach "localhost" on your computer, so your
  backend needs a public URL. Easiest paths:
    - Deploy the /server folder to Render, Railway, or Fly.io (all have free tiers).
    - Or run it on a small VPS and put it behind a domain with HTTPS
      (Roblox requires HTTPS for HttpService requests).
  Once deployed, put that URL in API_URL above.
]]
