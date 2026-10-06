export function editorErrors(value,publishing=false){const errors={};
 if(!value.title?.trim())errors.title='Donnez un titre à votre projet.';
 if(value.year&&!/^\d{4}$/.test(value.year))errors.year='Indiquez une année sur quatre chiffres, par exemple 2026.';
 if(!Number.isInteger(value.position)||value.position<0||value.position>9999)errors.position='Choisissez un nombre entre 0 et 9999.';
 if(publishing&&!value.images.length)errors.photos='Ajoutez au moins une photo avant de publier.';
 if(publishing)value.images.forEach((image,i)=>{if(!image.alt.trim())errors['alt-'+i]='Décrivez cette image avant de publier.'});
 return errors;
}
