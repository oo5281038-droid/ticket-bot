const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits, 
    ChannelType, 
    SlashCommandBuilder, 
    REST, 
    Routes,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActivityType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.MessageContent
    ]
});

// ==================== CONFIGURATION ====================
const CONFIG = {
    TOKEN: process.env.TOKEN, 
    
    CLIENT_ID: "1540099644028096572", 
    GUILD_ID: "1538685893622108251",  
    
    FREE_SPIN_ADMIN_ROLE_ID: "1538910850272722997", 

    SERVER_BANNER: "https://cdn.discordapp.com/attachments/1315665568228966410/1540122036725350441/octopus_png_banner.png?ex=6a88cdeb&is=6a877c6b&hm=9f964c7489d7150b992380365654f836dec100d2b76a8c2daeb0e162bb15afac&", 
    SETUP_CHANNEL_ID: "1538901953331986594", 
    INVITES_REQUIRED: 6, 

    // Streamer Mode / Streaming Status Config
    STREAMING: {
        NAME: "Discord.gg/Octopus-s",
        URL: "https://www.twitch.tv/discord" 
    },

    // ALL EMOJIS ARE CENTRALIZED HERE FOR EASY EDITING
    EMOJIS: {
        // Custom Emojis
        PUB: "<:kndpub:1540126362658938940>",
        BUGS: "<a:emoji:1540126667815526451>",
        DONATE: "<:mny:1540091412719210637>",
        REMPLACEMENT: "<a:work1:1540127049132286022>",
        SPIN: "<a:extra_7:1540127733231648808>",
        DELETE: "<:delete:1540129242107346984>",
        CLAIM: "<:claim:1540129878916210738>",
        RENAME: "<:emoji_164:1539801927955648552>",

        // Standard / System Emojis
        BOT_READY: "🤖",
        SUCCESS: "✅",
        ERROR: "❌",
        LOCK: "🔒",
        SWORD: "⚔️",
        FLOWER_SPARK: "🌸⚡",
        TIMER: "⏱️",
        FREE_SPIN_TICKET: "🎟️",
        STATS: "📊",
        CONGRATS: "🎉",
        INBOX: "📥",
        WARNING: "⚠️",
        PENCIL: "✏️",
        SLOT_MACHINE: "🎰"
    },

    TICKETS: {
        pub: {
            name: "Pub",
            label: "Pub",
            categoryId: "1540123963043086417",
            roleId: "1540124358771605565"
        },
        bugs: {
            name: "Bugs",
            label: "Bugs",
            categoryId: "1540123985860239472",
            roleId: "1540124504406098071"
        },
        donate: {
            name: "Donate",
            label: "Donate",
            categoryId: "1540123940700299374",
            roleId: "1540124475503280229"
        },
        remplacement: {
            name: "Remplacement",
            label: "Remplacement",
            categoryId: "1540123905480462456",
            roleId: "1540124434772533308"
        },
        spin: {
            name: "Spin Wheel",
            label: "Spin Wheel",
            categoryId: "1540124005137121370",
            roleId: "1540124575042637955"
        }
    }
};

const invitesCache = new Map();
const projectsDir = path.join(__dirname, 'projects');
const spinsFilePath = path.join(__dirname, 'free_spins.json');

if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir);
}

function getFreeSpinsData() {
    if (!fs.existsSync(spinsFilePath)) {
        fs.writeFileSync(spinsFilePath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(spinsFilePath, 'utf8'));
}

function saveFreeSpinsData(data) {
    fs.writeFileSync(spinsFilePath, JSON.stringify(data, null, 2));
}

function getTicketTypeByChannel(channel) {
    if (!channel || !channel.parentId) return null;
    return Object.values(CONFIG.TICKETS).find(t => t.categoryId === channel.parentId);
}

function cleanExpiredSpins() {
    const spinsData = getFreeSpinsData();
    const now = Date.now();
    let updated = false;

    for (const userId in spinsData) {
        if (spinsData[userId].expiresAt && spinsData[userId].expiresAt < now) {
            delete spinsData[userId];
            updated = true;
        }
    }

    if (updated) {
        saveFreeSpinsData(spinsData);
    }
}

setInterval(cleanExpiredSpins, 60000);

function getAllTxtFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllTxtFiles(fullPath, arrayOfFiles);
        } else if (file.endsWith('.txt')) {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

// ==================== READY EVENT & SLASH COMMANDS ====================

client.once('ready', async () => {
    console.log(`${CONFIG.EMOJIS.BOT_READY} Bot Ready! Logged in as ${client.user.tag}`);
    cleanExpiredSpins();
    
    // Set Streaming Status (Streamer Mode)
    client.user.setActivity(CONFIG.STREAMING.NAME, {
        type: ActivityType.Streaming,
        url: CONFIG.STREAMING.URL
    });

    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const firstInvites = await guild.invites.fetch();
            invitesCache.set(guild.id, new Map(firstInvites.map(inv => [inv.code, inv.uses])));
        } catch (err) {
            console.log(`Could not fetch invites for ${guild.name}`);
        }
    }

    const commands = [
        new SlashCommandBuilder()
            .setName('setup-ticket')
            .setDescription('Setup the ticket panel (Admin only)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('spin')
            .setDescription('Spin to get a random project (Requires free spins or enough invites)'),
        new SlashCommandBuilder()
            .setName('givefreespin')
            .setDescription('Give free spins to a specific user with expiration duration')
            .addUserOption(option => 
                option.setName('user')
                    .setDescription('The user to give free spins to')
                    .setRequired(true))
            .addIntegerOption(option => 
                option.setName('amount')
                    .setDescription('Amount of free spins')
                    .setRequired(true))
            .addNumberOption(option => 
                option.setName('hours')
                    .setDescription('Expiration time in hours (e.g. 1.5 for 1 hour 30 mins)')
                    .setRequired(true))
    ];

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
            { body: commands }
        );
        console.log(`${CONFIG.EMOJIS.SUCCESS} Commands registered!`);
    } catch (error) {
        console.error("Error registering slash commands:", error);
    }
});

client.on('inviteCreate', invite => {
    const guildInvites = invitesCache.get(invite.guild.id) || new Map();
    guildInvites.set(invite.code, invite.uses);
    invitesCache.set(invite.guild.id, guildInvites);
});

client.on('guildMemberAdd', async member => {
    try {
        const newInvites = await member.guild.invites.fetch();
        invitesCache.set(member.guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));
    } catch (err) {
        console.log("Could not update invites cache on join");
    }
});

// ==================== PREFIX COMMANDS ====================

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const ticketConfig = getTicketTypeByChannel(message.channel);
    if (!ticketConfig) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === '$close') {
        await message.reply(`${CONFIG.EMOJIS.LOCK} This ticket will be closed in 5 seconds...`);
        setTimeout(() => message.channel.delete().catch(() => {}), 5000);
    }

    if (command === '$claim') {
        const hasStaffRole = message.member.roles.cache.has(ticketConfig.roleId);
        if (!hasStaffRole && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply(`${CONFIG.EMOJIS.ERROR} Only staff members for this category can claim this ticket!`);
        }

        const newName = `claimed-by-${message.author.username}`;
        await message.channel.setName(newName);

        return message.reply(`${CONFIG.EMOJIS.SUCCESS} Ticket successfully claimed by **<@${message.author.id}>**! Channel renamed to: \`${newName}\``);
    }

    if (command === '$rename') {
        const newName = args.join('-');
        if (!newName) {
            return message.reply(`${CONFIG.EMOJIS.ERROR} Please provide a new name! Example: \`$rename my-new-ticket\``);
        }

        await message.channel.setName(newName);
        return message.reply(`${CONFIG.EMOJIS.PENCIL} Ticket renamed to: \`${newName}\``);
    }
});

// ==================== INTERACTION HANDLING ====================

client.on('interactionCreate', async interaction => {
    
    if (interaction.isChatInputCommand()) {
        
        if (interaction.commandName === 'setup-ticket') {
            if (interaction.channelId !== CONFIG.SETUP_CHANNEL_ID) {
                return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} You can only use this command in <#${CONFIG.SETUP_CHANNEL_ID}>!`, ephemeral: true });
            }

            const ticketEmbed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setAuthor({ name: `${interaction.guild.name} • Ticket Support System`, iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    `• Welcome to our Support & Order Center! Please select the ticket type matching your request:\n\n` +
                    `• ${CONFIG.EMOJIS.PUB} **${CONFIG.TICKETS.pub.label}** : Report spam or pub ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.BUGS} **${CONFIG.TICKETS.bugs.label}** : Report bugs or issues ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.REMPLACEMENT} **${CONFIG.TICKETS.remplacement.label}** : Report issues or replacement ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.DONATE} **${CONFIG.TICKETS.donate.label}** : Support The Server ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.SPIN} **${CONFIG.TICKETS.spin.label}** : Open Spin Ticket ${CONFIG.EMOJIS.SWORD}\n\n` +
                    `• ${CONFIG.EMOJIS.FLOWER_SPARK} Use these modules for assistance, orders or tickets. Our team is here to help!`
                )
                .setImage(CONFIG.SERVER_BANNER);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_pub').setLabel(CONFIG.TICKETS.pub.label).setEmoji(CONFIG.EMOJIS.PUB).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_bugs').setLabel(CONFIG.TICKETS.bugs.label).setEmoji(CONFIG.EMOJIS.BUGS).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_remplacement').setLabel(CONFIG.TICKETS.remplacement.label).setEmoji(CONFIG.EMOJIS.REMPLACEMENT).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_donate').setLabel(CONFIG.TICKETS.donate.label).setEmoji(CONFIG.EMOJIS.DONATE).setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_spin').setLabel(CONFIG.TICKETS.spin.label).setEmoji(CONFIG.EMOJIS.SPIN).setStyle(ButtonStyle.Primary)
            );

            await interaction.channel.send({ embeds: [ticketEmbed], components: [row] });
            return interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} Ticket Panel sent successfully!`, ephemeral: true });
        }

        if (interaction.commandName === 'givefreespin') {
            const hasRole = interaction.member.roles.cache.has(CONFIG.FREE_SPIN_ADMIN_ROLE_ID);
            if (!hasRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} You don't have permission to use this command!`, ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const hours = interaction.options.getNumber('hours');

            if (amount <= 0 || hours <= 0) {
                return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} Amount and Hours must be greater than 0!`, ephemeral: true });
            }

            cleanExpiredSpins();
            const spinsData = getFreeSpinsData();
            
            const expiresAt = Date.now() + (hours * 60 * 60 * 1000);
            const currentAmount = spinsData[targetUser.id] ? spinsData[targetUser.id].amount : 0;

            spinsData[targetUser.id] = {
                amount: currentAmount + amount,
                expiresAt: expiresAt
            };

            saveFreeSpinsData(spinsData);

            return interaction.reply({ 
                content: `${CONFIG.EMOJIS.SUCCESS} Granted **${amount}** Free Spin(s) to <@${targetUser.id}>!\n${CONFIG.EMOJIS.TIMER} Expires in **${hours}** hour(s) (If unused, they will be removed).` 
            });
        }

        if (interaction.commandName === 'spin') {
            const channelCategory = interaction.channel.parentId;
            if (channelCategory !== CONFIG.TICKETS.spin.categoryId) {
                return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} You can only use the \`/spin\` command inside a Spin Wheel ticket!`, ephemeral: true });
            }

            cleanExpiredSpins();
            const spinsData = getFreeSpinsData();
            const userSpinInfo = spinsData[interaction.user.id];
            
            let usedFreeSpin = false;
            let remainingSpins = 0;

            if (userSpinInfo && userSpinInfo.amount > 0) {
                userSpinInfo.amount -= 1;
                remainingSpins = userSpinInfo.amount;
                if (userSpinInfo.amount <= 0) {
                    delete spinsData[interaction.user.id];
                } else {
                    spinsData[interaction.user.id] = userSpinInfo;
                }
                saveFreeSpinsData(spinsData);
                usedFreeSpin = true;
            } else {
                const invites = await interaction.guild.invites.fetch();
                const userInvites = invites.filter(i => i.inviter && i.inviter.id === interaction.user.id);
                let totalInvites = 0;
                userInvites.forEach(inv => totalInvites += inv.uses);

                if (totalInvites < CONFIG.INVITES_REQUIRED) {
                    return interaction.reply({ 
                        content: `${CONFIG.EMOJIS.ERROR} You have no Free Spins left and need **${CONFIG.INVITES_REQUIRED}** invites! You currently have **${totalInvites}** invites.`, 
                        ephemeral: true 
                    });
                }
            }

            const allFiles = getAllTxtFiles(projectsDir);
            if (allFiles.length === 0) {
                return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} No project files found in the projects folder currently.`, ephemeral: true });
            }

            const randomFilePath = allFiles[Math.floor(Math.random() * allFiles.length)];
            const fileName = path.basename(randomFilePath);

            const spinTypeMsg = usedFreeSpin 
                ? `${CONFIG.EMOJIS.FREE_SPIN_TICKET} *(Used 1 Free Spin, remaining: **${remainingSpins}**)*`
                : `${CONFIG.EMOJIS.STATS} *(Used your server invites)*`;

            const msgText = `${CONFIG.EMOJIS.CONGRATS} **Congratulations!** Here is your project from the Spin Wheel (**${fileName}**):\n${spinTypeMsg}`;

            try {
                await interaction.user.send({
                    content: msgText,
                    files: [randomFilePath]
                });

                return interaction.reply({
                    content: `${CONFIG.EMOJIS.INBOX} **We sent your project via Direct Message (DM)!** Please check your messages.\n${spinTypeMsg}`
                });

            } catch (err) {
                return interaction.reply({ 
                    content: `${CONFIG.EMOJIS.WARNING} **Your DMs are closed!** Here is your project directly in the ticket:\n\n${msgText}`,
                    files: [randomFilePath]
                });
            }
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_rename_ticket') {
            const newName = interaction.fields.getTextInputValue('input_ticket_name');
            await interaction.channel.setName(newName);
            return interaction.reply({ content: `${CONFIG.EMOJIS.PENCIL} Ticket renamed to: \`${newName}\`` });
        }
    }

    if (interaction.isButton()) {
        
        if (interaction.customId === 'ticket_close') {
            await interaction.reply({ content: `${CONFIG.EMOJIS.LOCK} This ticket will be closed in 5 seconds...` });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            return;
        }

        if (interaction.customId === 'ticket_claim') {
            const ticketConfig = getTicketTypeByChannel(interaction.channel);
            if (ticketConfig) {
                const hasStaffRole = interaction.member.roles.cache.has(ticketConfig.roleId);
                if (!hasStaffRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} Only staff members for this category can claim this ticket!`, ephemeral: true });
                }
            }

            const newName = `claimed-by-${interaction.user.username}`;
            await interaction.channel.setName(newName);

            return interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} Ticket successfully claimed by **<@${interaction.user.id}>**! Channel renamed to: \`${newName}\`` });
        }

        if (interaction.customId === 'ticket_rename') {
            const modal = new ModalBuilder()
                .setCustomId('modal_rename_ticket')
                .setTitle('Rename Ticket');

            const nameInput = new TextInputBuilder()
                .setCustomId('input_ticket_name')
                .setLabel('New Ticket Name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter the new channel name...')
                .setRequired(true);

            const modalRow = new ActionRowBuilder().addComponents(nameInput);
            modal.addComponents(modalRow);

            return interaction.showModal(modal);
        }

        const typeMap = {
            'btn_pub': CONFIG.TICKETS.pub,
            'btn_bugs': CONFIG.TICKETS.bugs,
            'btn_remplacement': CONFIG.TICKETS.remplacement,
            'btn_donate': CONFIG.TICKETS.donate,
            'btn_spin': CONFIG.TICKETS.spin
        };

        const buttonEmojiMap = {
            'btn_pub': CONFIG.EMOJIS.PUB,
            'btn_bugs': CONFIG.EMOJIS.BUGS,
            'btn_remplacement': CONFIG.EMOJIS.REMPLACEMENT,
            'btn_donate': CONFIG.EMOJIS.DONATE,
            'btn_spin': CONFIG.EMOJIS.SPIN
        };

        const selectedTicket = typeMap[interaction.customId];
        const selectedEmoji = buttonEmojiMap[interaction.customId];
        if (!selectedTicket) return;

        const category = interaction.guild.channels.cache.get(selectedTicket.categoryId);
        if (!category) {
            return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} Invalid ticket category! Please check IDs in CONFIG.`, ephemeral: true });
        }

        const ticketChannel = await interaction.guild.channels.create({
            name: `${selectedTicket.name.toLowerCase()}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
                },
                {
                    id: selectedTicket.roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
                }
            ]
        });

        const embedMsg = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle(`${selectedEmoji} Ticket: ${selectedTicket.name}`)
            .setDescription(`Welcome <@${interaction.user.id}>! <@&${selectedTicket.roleId}> staff will assist you shortly.`)
            .setThumbnail(client.user.displayAvatarURL());

        if (interaction.customId === 'btn_spin') {
            embedMsg.addFields({ name: `${CONFIG.EMOJIS.SLOT_MACHINE} Spin Instructions`, value: "If you have Free Spins or 6 invites, type `/spin` here to get your project!" });
        }

        const ticketControlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji(CONFIG.EMOJIS.DELETE).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setEmoji(CONFIG.EMOJIS.CLAIM).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ticket_rename').setLabel('Rename').setEmoji(CONFIG.EMOJIS.RENAME).setStyle(ButtonStyle.Secondary)
        );

        await ticketChannel.send({ 
            content: `<@${interaction.user.id}> | <@&${selectedTicket.roleId}>`, 
            embeds: [embedMsg],
            components: [ticketControlRow]
        });

        return interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} Your ticket has been opened here: ${ticketChannel}`, ephemeral: true });
    }
});

client.login(CONFIG.TOKEN);
