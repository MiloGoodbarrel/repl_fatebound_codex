import { createRepository, getAuthenticatedUser } from '../server/github';

async function main() {
  try {
    const user = await getAuthenticatedUser();
    console.log(`Authenticated as: ${user.login}`);
    
    const repoName = 'dnd-dm-toolkit';
    const description = 'A Dungeons & Dragons Dungeon Master toolkit with Initiative Tracker and Deck of Loot features';
    
    console.log(`Creating repository: ${repoName}...`);
    const repo = await createRepository(repoName, description, false);
    
    console.log(`Repository created successfully!`);
    console.log(`URL: ${repo.html_url}`);
    console.log(`Clone URL: ${repo.clone_url}`);
    console.log(`SSH URL: ${repo.ssh_url}`);
    
  } catch (error: any) {
    if (error.status === 422) {
      console.log('Repository may already exist. Fetching info...');
      const user = await getAuthenticatedUser();
      console.log(`Check: https://github.com/${user.login}/dnd-dm-toolkit`);
    } else {
      console.error('Error:', error.message);
    }
  }
}

main();
