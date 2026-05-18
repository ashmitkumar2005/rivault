# Contributing to Rivault

First off, thank you for considering contributing to Rivault! It's people like you that make Rivault such a great tool.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/ashmitkumar2005/rivault/issues) to see if someone else has already created a ticket. If not, go ahead and [make one](https://github.com/ashmitkumar2005/rivault/issues/new)!

## Fork & create a branch

If this is something you think you can fix, then fork Rivault and create a branch with a descriptive name.

A good branch name would be (where issue #325 is the ticket you're working on):

```sh
git checkout -b 325-add-contribution-guidelines
```

## Get the test suite running

Make sure you're using Node.js version 18 or higher.

To set up the project locally:

1. Clone your fork.
2. Run `npm install` in the root folder to install frontend dependencies.
3. Run `cd backend && npm install` to install backend dependencies.
4. Setup your `.env` files using `.env.example`.
5. Start frontend and backend as described in the `README.md`.

## Implement your fix or feature

At this point, you're ready to make your changes! Feel free to ask for help; everyone is a beginner at first.

## Make a Pull Request

At this point, you should switch back to your master branch and make sure it's up to date with Rivault's master branch:

```sh
git remote add upstream https://github.com/ashmitkumar2005/rivault.git
git checkout master
git pull upstream master
```

Then update your feature branch from your local copy of master, and push it!

```sh
git checkout 325-add-contribution-guidelines
git rebase master
git push --set-upstream origin 325-add-contribution-guidelines
```

Finally, go to GitHub and [make a Pull Request](https://github.com/ashmitkumar2005/rivault/compare) :D

## Keeping your Pull Request updated

If a maintainer asks you to "rebase" your PR, they're saying that a lot of code has changed, and that you need to update your branch so it's easier to merge.

## Code Style

- Use Prettier for formatting.
- Ensure ESLint passes before submitting your PR.
