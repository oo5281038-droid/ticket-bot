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
    TextInputStyle
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

    TICKETS: {
        pub: {
            name: "Pub",
            label: "Pub",
            emoji: "<:kndpub:1540126362658938940>",
            categoryId: "1540123963043086417",
            roleId: "1540124358771605565"
        },
        bugs: {
            name: "Bugs",
            label: "Bugs",
            emoji: "<a:emoji:1540126667815526451>",
            categoryId: "1540123985860239472",
            roleId: "1540124504406098071"
        },
        donate: {
            name: "Donate",
            label: "Donate",
            emoji: "<:mny:1540091412719210637>",
            categoryId: "1540123940700299374",
            roleId: "1540124475503280229"
        },
        remplacement: {
            name: "Remplacement",
            label: "Remplacement",
            emoji: "<a:work1:1540127049132286022>",
            categoryId: "1540123905480462456",
            roleId: "1540124434772533308"
        },
        spin: {
            name: "Spin Wheel",
            label: "Spin Wheel",
            emoji: "<a:extra_7:1540127733231648808>",
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

// Clean expired spins
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

// Check every 1 minute for expired spins
setInterval(cleanExpiredSpins, 60000);

// Helper function to read recursive txt files if folder is nested
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
    console.log(`🤖 Bot Ready! Logged in as ${client.user.tag}`);
    cleanExpiredSpins();
    
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
        console.log("✅ Commands registered!");
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
        await message.reply("🔒 Had ticket ghadi tsdd f 5 seconds...");
        setTimeout(() => message.channel.delete().catch(() => {}), 5000);
    }

    if (command === '$claim') {
        const hasStaffRole = message.member.roles.cache.has(ticketConfig.roleId);
        if (!hasStaffRole && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ Ghir l-staff dial had category li y9dr y-claimi ticket!");
        }

        const newName = `claimed-by-${message.author.username}`;
        await message.channel.setName(newName);

        return message.reply(`✅ Had ticket t-claimat b nja7 mn طرف **<@${message.author.id}>**! Channel name wlat: \`${newName}\``);
    }

    if (command === '$rename') {
        const newName = args.join('-');
        if (!newName) {
            return message.reply("❌ Khassk taktab smya l-jadida! M3al: `$rename my-new-ticket`");
        }

        await message.channel.setName(newName);
        return message.reply(`✏️ Had ticket tbdlat smيتها l: \`${newName}\``);
    }
});

// ==================== INTERACTION HANDLING ====================

client.on('interactionCreate', async interaction => {
    
    if (interaction.isChatInputCommand()) {
        
        if (interaction.commandName === 'setup-ticket') {
            if (interaction.channelId !== CONFIG.SETUP_CHANNEL_ID) {
                return interaction.reply({ content: `❌ Had command t9dr ddirha ghir f <#${CONFIG.SETUP_CHANNEL_ID}>!`, ephemeral: true });
            }

            const ticketEmbed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setAuthor({ name: `${interaction.guild.name} • Ticket Support System`, iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    `• Welcome to our Support & Order Center! Please select the ticket type matching your request:\n\n` +
                    `• ${CONFIG.TICKETS.pub.emoji} **${CONFIG.TICKETS.pub.label}** : Report spam or pub ⚔️\n` +
                    `• ${CONFIG.TICKETS.bugs.emoji} **${CONFIG.TICKETS.bugs.label}** : Report bugs or issues ⚔️\n` +
                    `• ${CONFIG.TICKETS.remplacement.emoji} **${CONFIG.TICKETS.remplacement.label}** : Report issues or replacement ⚔️\n` +
                    `• ${CONFIG.TICKETS.donate.emoji} **${CONFIG.TICKETS.donate.label}** : Support The Server ⚔️\n` +
                    `• ${CONFIG.TICKETS.spin.emoji} **${CONFIG.TICKETS.spin.label}** : Open Spin Ticket ⚔️\n\n` +
                    `• 🌸⚡ Use these modules for assistance, orders or tickets. Our team is here to help!`
                )
                .setImage(CONFIG.SERVER_BANNER);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_pub').setLabel(CONFIG.TICKETS.pub.label).setEmoji(CONFIG.TICKETS.pub.emoji).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_bugs').setLabel(CONFIG.TICKETS.bugs.label).setEmoji(CONFIG.TICKETS.bugs.emoji).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_remplacement').setLabel(CONFIG.TICKETS.remplacement.label).setEmoji(CONFIG.TICKETS.remplacement.emoji).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_donate').setLabel(CONFIG.TICKETS.donate.label).setEmoji(CONFIG.TICKETS.donate.emoji).setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_spin').setLabel(CONFIG.TICKETS.spin.label).setEmoji(CONFIG.TICKETS.spin.emoji).setStyle(ButtonStyle.Primary)
            );

            await interaction.channel.send({ embeds: [ticketEmbed], components: [row] });
            return interaction.reply({ content: "✅ Ticket Panel sent successfully!", ephemeral: true });
        }

        if (interaction.commandName === 'givefreespin') {
            const hasRole = interaction.member.roles.cache.has(CONFIG.FREE_SPIN_ADMIN_ROLE_ID);
            if (!hasRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: "❌ Ma-3ndksh permission/role باش tst3ml had command!", ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const hours = interaction.options.getNumber('hours');

            if (amount <= 0 || hours <= 0) {
                return interaction.reply({ content: "❌ Amount w Hours khasshom ikounou akbar mn 0!", ephemeral: true });
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
                content: `✅ T3tat **${amount}** Free Spin(s) l <@${targetUser.id}>!\n⏱️ Ghadi ysaliw f **${hours}** sa3a (Ila madarch \`/spin\`, ghadi imchiw).` 
            });
        }

        if (interaction.commandName === 'spin') {
            const channelCategory = interaction.channel.parentId;
            if (channelCategory !== CONFIG.TICKETS.spin.categoryId) {
                return interaction.reply({ content: "❌ Command `/spin` t9dr tst3mlha ghir f ticket dial Spin Wheel!", ephemeral: true });
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
                        content: `❌ Ma-3ndksh Free Spins w khassk **${CONFIG.INVITES_REQUIRED}** invites! Nta 3ndk **${totalInvites}** invites.`, 
                        ephemeral: true 
                    });
                }
            }

            const allFiles = getAllTxtFiles(projectsDir);
            if (allFiles.length === 0) {
                return interaction.reply({ content: "❌ Ulac project files f folder dial projects حاليا.", ephemeral: true });
            }

            const randomFilePath = allFiles[Math.floor(Math.random() * allFiles.length)];
            const fileName = path.basename(randomFilePath);

            const spinTypeMsg = usedFreeSpin 
                ? `🎟️ *(St3malti 1 Free Spin, ba9i lik: **${remainingSpins}**)*`
                : `📊 *(St3malti l-invites dialk)*`;

            const msgText = `🎉 **Mabrouk!** Ha huwa l-project dialk li jtik f l-Spin Wheel (**${fileName}**):\n${spinTypeMsg}`;

            // Try to send to DM first
            try {
                await interaction.user.send({
                    content: msgText,
                    files: [randomFilePath]
                });

                return interaction.reply({
                    content: `📥 **Sftna lik l-project f Private (DM)!** Check l-messages dialk.\n${spinTypeMsg}`
                });

            } catch (err) {
                // If DM is closed, send directly in the ticket
                return interaction.reply({ 
                    content: `⚠️ **DM dialk msdud!** Ha huwa l-project dialk hna f-l-ticket:\n\n${msgText}`,
                    files: [randomFilePath]
                });
            }
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_rename_ticket') {
            const newName = interaction.fields.getTextInputValue('input_ticket_name');
            await interaction.channel.setName(newName);
            return interaction.reply({ content: `✏️ Had ticket tbdlat smيتها l: \`${newName}\`` });
        }
    }

    if (interaction.isButton()) {
        
        if (interaction.customId === 'ticket_close') {
            await interaction.reply({ content: "🔒 Had ticket ghadi tsdd f 5 seconds..." });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            return;
        }

        if (interaction.customId === 'ticket_claim') {
            const ticketConfig = getTicketTypeByChannel(interaction.channel);
            if (ticketConfig) {
                const hasStaffRole = interaction.member.roles.cache.has(ticketConfig.roleId);
                if (!hasStaffRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: "❌ Ghir l-staff dial had category li y9dr y-claimi ticket!", ephemeral: true });
                }
            }

            const newName = `claimed-by-${interaction.user.username}`;
            await interaction.channel.setName(newName);

            return interaction.reply({ content: `✅ Had ticket t-claimat b nja7 mn طرف **<@${interaction.user.id}>**! Channel name wlat: \`${newName}\`` });
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

        const selectedTicket = typeMap[interaction.customId];
        if (!selectedTicket) return;

        const category = interaction.guild.channels.cache.get(selectedTicket.categoryId);
        if (!category) {
            return interaction.reply({ content: "❌ Category dial had ticket makhddamach! Check IDs f CONFIG.", ephemeral: true });
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
            .setTitle(`${selectedTicket.emoji} Ticket: ${selectedTicket.name}`)
            .setDescription(`Marhaba <@${interaction.user.id}>! L-staff <@&${selectedTicket.roleId}> ghadi yjawbouk f 9reb wa9t.`)
            .setThumbnail(client.user.displayAvatarURL());

        if (interaction.customId === 'btn_spin') {
            embedMsg.addFields({ name: "🎰 Spin Instructions", value: "Ila 3ndk Free Spins aw 6 invites, ktab `/spin` hna باش takhod project dialk!" });
        }

        const ticketControlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji('<:delete:1540129242107346984>').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setEmoji('<:claim:1540129878916210738>').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ticket_rename').setLabel('Rename').setEmoji('<:emoji_164:1539801927955648552>').setStyle(ButtonStyle.Secondary)
        );

        await ticketChannel.send({ 
            content: `<@${interaction.user.id}> | <@&${selectedTicket.roleId}>`, 
            embeds: [embedMsg],
            components: [ticketControlRow]
        });

        return interaction.reply({ content: `✅ Ticket dialk tft7at hna: ${ticketChannel}`, ephemeral: true });
    }
});

client.login(CONFIG.TOKEN);
