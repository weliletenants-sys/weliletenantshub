# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/b0e338a6-4dda-4085-8ad1-caae7e4e4555

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/b0e338a6-4dda-4085-8ad1-caae7e4e4555) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/b0e338a6-4dda-4085-8ad1-caae7e4e4555) and click on Share -> Publish.

### ⚠️ IMPORTANT: Before Every Publish

**To enable automatic updates on all user devices**, you MUST update the version number:

1. Open `public/version.json`
2. Increment the `version` number (e.g., `2.0.1` → `2.0.2`)
3. Update the `buildTime` timestamp
4. Then click Publish in Lovable

```json
{
  "version": "2.0.2",  // ⬅️ CHANGE THIS!
  "buildTime": "2025-01-15T12:00:00Z",  // ⬅️ UPDATE THIS!
  "description": "Welile Tenants Hub - [Your changes]"
}
```

**Why?** The app checks this file every 2 minutes to detect updates. When users' devices see a new version number, they automatically reload with the latest changes - no manual refresh needed!

📖 **Read full documentation**: `docs/AUTOMATIC_UPDATES.md`

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
